import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { toSlug, artistEmail } from "@/lib/email";
import { kvGet } from "@/lib/kv";
import { discoverContactsForDomain, type DiscoveredContact } from "@/lib/hunter";
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
  confidence?: number; // Hunter confidence 0-100
}

// ── Missions ────────────────────────────────────────────────────────────────
// A mission maps the user's goal to: what kind of OUTLETS to find, which
// roles are relevant at those outlets, and what the pitch asks for. We name
// outlets with the LLM (it's good at that) then discover real contacts via
// Hunter — instead of letting the LLM hallucinate individual emails.
interface MissionConfig {
  label: string;
  outletKind: string; // {genre} / {city} placeholders filled below
  roleKeywords: string[];
  defaultRole: string;
  pitchGoal: string;
  needsCity?: boolean;
}

const MISSIONS: Record<string, MissionConfig> = {
  press: {
    label: "Press",
    outletKind: "music blogs, magazines, and online publications that review or cover {genre} artists",
    roleKeywords: ["editor", "writer", "journalist", "contributor", "features", "news", "music", "pitches", "tips", "editorial", "contact"],
    defaultRole: "Journalist",
    pitchGoal: "pitch the artist's latest release for coverage, a feature, or a review",
  },
  playlist: {
    label: "Playlists",
    outletKind: "independent playlist curators, playlist networks, and music-discovery blogs that playlist {genre}",
    roleKeywords: ["curator", "playlist", "a&r", "submissions", "music", "editor", "contact"],
    defaultRole: "Playlist Curator",
    pitchGoal: "pitch the artist's track for playlist consideration",
  },
  sync: {
    label: "Sync / Licensing",
    outletKind: "music supervision companies, sync agencies, and licensing libraries that place {genre} in film, TV, ads, or games",
    roleKeywords: ["supervisor", "sync", "licensing", "creative", "a&r", "music", "contact"],
    defaultRole: "Music Supervisor",
    pitchGoal: "introduce the artist's catalog for sync/licensing placement",
  },
  radio: {
    label: "Radio",
    outletKind: "college, community, and independent radio stations that play {genre}",
    roleKeywords: ["dj", "program", "music director", "host", "station", "radio", "submissions", "contact"],
    defaultRole: "Radio DJ",
    pitchGoal: "submit the artist's track for radio airplay consideration",
  },
  venue: {
    label: "Venues",
    outletKind: "real, currently-operating music venues in {city} that book {genre} artists at a comparable draw level (roughly 100-500 capacity)",
    roleKeywords: ["booking", "talent", "buyer", "events", "programming", "promoter", "calendar", "info", "contact"],
    defaultRole: "Venue / Talent Buyer",
    pitchGoal: "pitch the artist to play a show at the venue",
    needsCity: true,
  },
};

interface OutletSuggestion {
  outlet: string;
  domain: string;
  why?: string;
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { artistData, mission = "press", city }: {
    artistData: ArtistData;
    mission?: string;
    city?: string;
  } = await req.json();

  if (!artistData) {
    return new Response(JSON.stringify({ error: "artistData required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const cfg = MISSIONS[mission] ?? MISSIONS.press;
  if (cfg.needsCity && !city?.trim()) {
    return new Response(JSON.stringify({ error: "city required for this mission", needsCity: true }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const slug = toSlug(artistData.name);
  const fromEmail = artistEmail(slug);
  const genre = (artistData.genres || [])[0] || "indie";
  const outletKind = cfg.outletKind
    .replace("{genre}", genre)
    .replace("{city}", city?.trim() || "");

  // Past contacts — never suggest someone already reached out to.
  const pastIds = (await kvGet<string[]>(`outreach-ids:${artistData.id}`)) ?? [];
  const pastRecords = (await Promise.all(
    pastIds.map((id) => kvGet<{ to?: string }>(`outreach:${artistData.id}:${id}`))
  )).filter((r): r is { to?: string } => r !== null);
  const contactedEmails = new Set(
    pastRecords.map((r) => (r.to || "").toLowerCase()).filter(Boolean)
  );

  try {
    // ── Step 1: LLM names real outlets (it's reliable at this) ──────────────
    const outletPrompt = `You are a music industry researcher. The artist "${artistData.name}" (genre: ${genre}) wants to reach ${outletKind}.

Name up to 12 REAL, currently-active outlets that are a genuinely strong fit. For each, give its primary website domain (bare domain only, e.g. "stereogum.com" — no https, no path).

Return ONLY a JSON array:
[{ "outlet": "Outlet Name", "domain": "example.com", "why": "one-sentence fit reason" }]

Rules: only real outlets you are confident exist, with their real domains. Do NOT invent outlets or domains. Better to return 6 real ones than 12 with guesses.`;

    const outletMsg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 900,
      messages: [{ role: "user", content: outletPrompt }],
    });
    const outletRaw = outletMsg.content[0].type === "text" ? outletMsg.content[0].text : "";
    const outletJson = outletRaw.match(/\[[\s\S]*\]/);
    if (!outletJson) {
      return new Response(JSON.stringify({ error: "Could not identify outlets. Try again." }), {
        status: 502, headers: { "Content-Type": "application/json" },
      });
    }
    const outlets: OutletSuggestion[] = JSON.parse(outletJson[0]);

    // ── Step 2: discover real contacts at each outlet domain via Hunter ─────
    const perOutlet = await Promise.all(
      outlets
        .filter((o) => o.domain)
        .map((o) =>
          discoverContactsForDomain(
            o.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""),
            o.outlet,
            cfg.roleKeywords,
            6
          )
        )
    );

    // Flatten, dedupe (by email, and against past outreach), cap the list.
    const seen = new Set<string>();
    const discovered: DiscoveredContact[] = [];
    for (const list of perOutlet) {
      for (const c of list) {
        const e = c.email.toLowerCase();
        if (seen.has(e) || contactedEmails.has(e)) continue;
        seen.add(e);
        discovered.push(c);
      }
    }
    // Already ranked within outlet (relevant role + confidence). Take a
    // healthy top slice to draft — gives the user real volume to choose from.
    const top = discovered.slice(0, 15);

    if (top.length === 0) {
      return new Response(JSON.stringify({
        drafts: [],
        fromEmail,
        outletsSearched: outlets.length,
        reason: `Searched ${outlets.length} ${cfg.label.toLowerCase()} outlets but couldn't find any verified contacts not already on your list. Try a different mission${cfg.needsCity ? " or city" : ""}.`,
      }), { headers: { "Content-Type": "application/json" } });
    }

    // ── Step 3: LLM writes a personalized pitch per discovered contact ──────
    const savedBio = await kvGet<SavedBio>(`helm:artist:${artistData.id}:bio`);
    const topTracks = (artistData.topTracks || []).slice(0, 5).map((t) => t.name).join(", ");
    const releaseList = (artistData.allReleases || []).slice(0, 5)
      .map((r) => `${r.name} (${r.type}, ${r.releaseDate})`).join("; ");

    const pitchPrompt = `You are writing outreach emails FROM ${artistData.name} <${fromEmail}>.

ARTIST: ${artistData.name} | Genre: ${genre} | Monthly listeners: ${artistData.monthlyListenersFormatted || "—"} | Top tracks: ${topTracks || "—"} | Recent: ${releaseList || "—"}${savedBio ? `\nBio: ${savedBio.medium}` : ""}

GOAL: ${cfg.pitchGoal}.

Write one email per contact below. Each: under 150 words, specific and human (reference their outlet), one clear ask, no fluff. Address the person by first name if provided, otherwise greet the outlet professionally.

CONTACTS:
${top.map((c, i) => `${i}. ${c.name || "(generic inbox)"}${c.position ? ` — ${c.position}` : ""} at ${c.outlet} <${c.email}>`).join("\n")}

Return ONLY a JSON array, one object per contact IN THE SAME ORDER:
[{ "i": 0, "subject": "...", "body": "..." }]`;

    const pitchMsg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: pitchPrompt }],
    });
    const pitchRaw = pitchMsg.content[0].type === "text" ? pitchMsg.content[0].text : "";
    const pitchJson = pitchRaw.match(/\[[\s\S]*\]/);
    const pitches: { i: number; subject: string; body: string }[] = pitchJson ? JSON.parse(pitchJson[0]) : [];
    const pitchByIndex = new Map(pitches.map((p) => [p.i, p]));

    const drafts: OutreachDraft[] = top.map((c, i) => {
      const p = pitchByIndex.get(i);
      return {
        to: c.email,
        toName: c.name || c.outlet,
        toRole: cfg.defaultRole,
        toPublication: c.outlet,
        subject: p?.subject || `${artistData.name} — ${cfg.label} outreach`,
        body: p?.body || "",
        rationale: c.position ? `${c.position} at ${c.outlet}` : `Contact at ${c.outlet}`,
        confidence: c.confidence,
      };
    }).filter((d) => d.body.trim().length > 0);

    return new Response(JSON.stringify({
      drafts,
      fromEmail,
      mission: cfg.label,
      outletsSearched: outlets.length,
      contactsFound: discovered.length,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Outreach generate error:", e);
    return new Response(JSON.stringify({ error: "Generation failed. Please try again." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
