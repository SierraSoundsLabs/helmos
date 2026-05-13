import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { toSlug, artistEmail } from "@/lib/email";
import { kvGet } from "@/lib/kv";
import type { ArtistData } from "@/lib/spotify";
import type { SavedBio } from "@/app/api/helm/bio/route";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface OutreachDraft {
  to: string;
  toName: string;
  toRole: string;
  toPublication?: string;
  subject: string;
  body: string;
  rationale: string;
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { artistData, count = 5 }: { artistData: ArtistData; count?: number } = await req.json();
  if (!artistData) {
    return new Response(JSON.stringify({ error: "artistData required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const safeCount = Math.min(Math.max(1, count), 10);
  const slug = toSlug(artistData.name);
  const fromEmail = artistEmail(slug);

  // Pull saved bio if available
  const savedBio = await kvGet<SavedBio>(`helm:artist:${artistData.id}:bio`);
  const bioSection = savedBio
    ? `\n- Artist Bio (medium): ${savedBio.medium}`
    : "";

  const releaseList = (artistData.allReleases || []).slice(0, 8)
    .map(r => `  - ${r.name} (${r.type}, ${r.releaseDate})`).join("\n");

  const topTracks = (artistData.topTracks || []).slice(0, 5)
    .map(t => t.name).join(", ");

  // Task 5: pull past outreach so Claude doesn't suggest contacting the
  // same person/publication twice.
  interface PastOutreach { to?: string; toName?: string; toPublication?: string }
  const pastIds = (await kvGet<string[]>(`outreach-ids:${artistData.id}`)) ?? [];
  const pastRecords = (await Promise.all(
    pastIds.map(id => kvGet<PastOutreach>(`outreach:${artistData.id}:${id}`))
  )).filter((r): r is PastOutreach => r !== null);

  const contactedEmails = new Set(
    pastRecords.map(r => (r.to || "").toLowerCase()).filter(Boolean)
  );
  const contactedKeys = new Set(
    pastRecords.map(r => `${(r.toName || "").toLowerCase()}|${(r.toPublication || "").toLowerCase()}`).filter(k => k !== "|")
  );

  // Surface up to the last 50 in the prompt — covers a typical artist's
  // history without bloating tokens.
  const avoidList = pastRecords
    .slice(-50)
    .map(r => `  - ${r.toName ?? "(unknown)"} at ${r.toPublication ?? "(no publication)"}${r.to ? ` <${r.to}>` : ""}`)
    .join("\n");
  const avoidSection = avoidList
    ? `\n\nDO NOT INCLUDE any of these contacts — they have already been reached out to. Suggest different people/publications instead:\n${avoidList}\n`
    : "";

  const prompt = `You are a music industry outreach specialist. Given this artist's profile, identify ${safeCount} real outreach targets and write a personalized email for each.

ARTIST PROFILE:
- Name: ${artistData.name}
- Email: ${fromEmail}
- Genres: ${(artistData.genres || []).join(", ")}
- Monthly Listeners: ${artistData.monthlyListenersFormatted || "—"}
- Spotify Followers: ${artistData.spotifyFollowersFormatted || "—"}
- Top Tracks: ${topTracks || "—"}
- Recent Releases:
${releaseList || "  No releases"}
- Last Released: ${artistData.monthsAgoLastRelease != null ? `${artistData.monthsAgoLastRelease} months ago` : "Unknown"}${bioSection}

TARGETS to identify (mix of these roles based on the artist's genre and stage):
- Music journalists / editors at blogs and publications covering this genre
- Independent playlist curators on Spotify
- Booking agents who work with artists at this level
- Music supervisors for sync licensing
- Radio DJs / program directors at college or independent stations

For each target, write a short, personalized outreach email FROM ${fromEmail}. The email should:
- Reference specific, real work the target has done (mention their real publication, playlist name, or booking history if applicable)
- Connect the artist's music to why this target would care
- Be concise (under 150 words)
- Have a clear, specific ask
- Sound human, not like a template${avoidSection}

Return a JSON array with exactly ${safeCount} objects. Each object must have these fields:
{
  "to": "real-or-realistic-email@publication.com",
  "toName": "Full Name",
  "toRole": "Journalist" | "Playlist Curator" | "Booking Agent" | "Music Supervisor" | "Radio DJ",
  "toPublication": "Publication/Playlist/Agency Name",
  "subject": "Email subject line",
  "body": "Full email body text (plain text, no HTML)",
  "rationale": "1-2 sentences: why this specific person is a good target for this artist"
}

Return ONLY the JSON array, no other text.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const rawDrafts: OutreachDraft[] = JSON.parse(jsonMatch[0]);

    // Belt-and-suspenders dedup in case the model still suggests
    // a contact that's already been reached out to.
    const drafts = rawDrafts.filter((d) => {
      const email = (d.to || "").toLowerCase();
      const key = `${(d.toName || "").toLowerCase()}|${(d.toPublication || "").toLowerCase()}`;
      if (email && contactedEmails.has(email)) return false;
      if (key !== "|" && contactedKeys.has(key)) return false;
      return true;
    });

    return new Response(JSON.stringify({
      drafts,
      fromEmail,
      droppedDuplicates: rawDrafts.length - drafts.length,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Outreach generate error:", e);
    return new Response(JSON.stringify({ error: "Generation failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
