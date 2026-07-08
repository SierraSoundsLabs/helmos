import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { kvGet } from "@/lib/kv";
import type { ArtistData } from "@/lib/spotify";
import type { SavedBio } from "@/app/api/helm/bio/route";
import type { LiveShowProfile } from "@/app/api/helm/live-show-profile/route";
import type { OutreachDraft } from "@/app/api/helm/outreach/generate/route";
import type { EnrichedVenue } from "@/lib/booking-intel";
import type { DiscoveredContact } from "@/lib/hunter";

// One Haiku call for N short pitches. Same shape as
// /api/helm/outreach/generate's pitch step. Well under the 60s cap.
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Turn a Booking Intel venue + its Hunter-discovered contacts into ready-to-
// send OutreachDrafts. The returned shape matches OutreachDraft exactly, so
// the existing /api/helm/outreach/send endpoint handles sending, KV
// persistence, deliverability gating, and daily-limit enforcement.
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { artistData, venue, contacts }: {
    artistData: ArtistData;
    venue: EnrichedVenue;
    contacts: DiscoveredContact[];
  } = await req.json();

  if (!artistData?.id || !venue?.venueName || !Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json(
      { error: "artistData, venue, and contacts required" },
      { status: 400 }
    );
  }

  // Cap at 5 drafts per generate. Users can run again for more contacts if
  // needed. This keeps the LLM call cheap and the results reviewable.
  const targetContacts = contacts.slice(0, 5);

  const [savedBio, liveShow] = await Promise.all([
    kvGet<SavedBio>(`helm:artist:${artistData.id}:bio`),
    kvGet<LiveShowProfile>(`helm:artist:${artistData.id}:live-show`),
  ]);

  const genre = (artistData.genres || []).slice(0, 3).join(", ") || "indie";
  const topTracks = (artistData.topTracks || []).slice(0, 3).map((t) => t.name).join(", ");
  const listeners = artistData.monthlyListenersFormatted || "—";

  // Live-show context is the booking-specific value-add. If the artist has
  // filled in their live-show profile we lean on it heavily — real credentials
  // are the difference between "generic AI pitch" and "real booking email".
  const liveShowLines = [
    liveShow?.credentials ? `Past credentials: ${liveShow.credentials}` : "",
    liveShow?.showDescription ? `Live show: ${liveShow.showDescription}` : "",
    liveShow?.bookingGoal ? `Currently looking for: ${liveShow.bookingGoal}` : "",
  ].filter(Boolean).join("\n");

  const bioLine = savedBio?.medium ? `Bio: ${savedBio.medium}` : "";

  const prompt = `You are writing booking-outreach emails FROM ${artistData.name}.

ARTIST
Name: ${artistData.name}
Genre: ${genre}
Monthly Spotify listeners: ${listeners}
Top tracks: ${topTracks || "—"}
${bioLine}
${liveShowLines}

VENUE
${venue.venueName}${venue.neighborhood ? ` (${venue.neighborhood})` : ""}, ${venue.city}${venue.capacity ? ` — ~${venue.capacity} cap` : ""}
Why this fits: ${venue.whyMatch}

CONTACTS AT THE VENUE
${targetContacts.map((c, i) => `${i}. ${c.name || "(booking inbox)"}${c.position ? ` — ${c.position}` : ""} <${c.email}>`).join("\n")}

Write one email per contact. Rules:
- Under 130 words each.
- Address the person by first name if given, otherwise a professional greeting.
- Reference the venue by name once.
- Ask specifically about a show — headline, co-bill, or opening slot depending on the artist's draw.
- Use ONLY the credentials in the ARTIST section. Do NOT invent past shows, sold-out gigs, press quotes, or tour history.
- If the artist has no live credentials listed, lead with their streaming/recorded work instead — do not fabricate live history.

Return ONLY a JSON array in the SAME order as CONTACTS, one object per contact:
[{ "i": 0, "subject": "…", "body": "…" }]`;

  let raw = "";
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });
    raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  } catch (err) {
    console.error("[Booking Intel] draft generation failed:", err);
    return NextResponse.json({ error: "Draft generation failed" }, { status: 500 });
  }

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "No drafts returned by model" }, { status: 502 });
  }

  let pitches: { i: number; subject: string; body: string }[];
  try {
    pitches = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "Model returned invalid JSON" }, { status: 502 });
  }
  const byIndex = new Map(pitches.map((p) => [p.i, p]));

  const drafts: OutreachDraft[] = targetContacts
    .map((c, i) => {
      const p = byIndex.get(i);
      if (!p?.body?.trim()) return null;
      return {
        to: c.email,
        toName: c.name || venue.venueName,
        toRole: c.position || "Venue / Talent Buyer",
        toPublication: venue.venueName,
        subject: p.subject || `${artistData.name} — ${venue.venueName} booking inquiry`,
        body: p.body,
        rationale: `${c.position ? `${c.position} at ` : ""}${venue.venueName} · ${venue.city}`,
        confidence: c.confidence,
      };
    })
    .filter((d): d is OutreachDraft => d !== null);

  return NextResponse.json({
    drafts,
    venue: venue.venueName,
    city: venue.city,
    contactsUsed: targetContacts.length,
  });
}
