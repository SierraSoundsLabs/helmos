import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { sendEmail, artistEmail, toSlug } from "@/lib/email";
import { kvGet, kvSet } from "@/lib/kv";
import type { ArtistData } from "@/lib/spotify";
import type { SavedBio } from "@/app/api/helm/bio/route";
import type { OutreachRecord } from "@/app/api/helm/outreach/send/route";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface BookingTarget {
  name: string;           // Band/venue/promoter name
  type: "band" | "venue" | "promoter" | "manager";
  email: string;
  contactName?: string;
  venue?: string;
  city: string;
  rationale: string;      // Why this is a good target
  pitchSubject: string;
  pitchBody: string;
}

export interface BookingOutreachResult {
  targets: BookingTarget[];
  sent: number;
  failed: number;
  city: string;
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { artistData, city, context }: {
    artistData: ArtistData;
    city: string;
    context?: string;
  } = await req.json();

  if (!artistData || !city) {
    return NextResponse.json({ error: "artistData and city required" }, { status: 400 });
  }

  // Check daily send limit
  const today = new Date().toISOString().split("T")[0];
  const countKey = `outreach-count:${artistData.id}:${today}`;
  const currentCount = (await kvGet<number>(countKey)) ?? 0;
  const MAX_PER_DAY = 10;
  const remaining = Math.min(5, MAX_PER_DAY - currentCount); // cap booking batch at 5
  if (remaining <= 0) {
    return NextResponse.json({ error: "Daily email limit reached" }, { status: 429 });
  }

  const slug = toSlug(artistData.name);
  const fromEmail = artistEmail(slug);
  const fromDisplay = `${artistData.name} <${fromEmail}>`;

  // Pull saved bio if available
  const savedBio = await kvGet<SavedBio>(`helm:artist:${artistData.id}:bio`);
  const bioContext = savedBio ? `\nArtist Bio: ${savedBio.medium}` : "";

  const genres = (artistData.genres || []).join(", ") || "indie";
  const topTracks = (artistData.topTracks || []).slice(0, 3).map(t => t.name).join(", ");
  const listeners = artistData.monthlyListenersFormatted || "—";

  // Step 1: Research targets and draft pitches in one call
  const researchPrompt = `You are a music industry booking specialist helping an independent artist get booked for shows in ${city}.

ARTIST PROFILE:
- Name: ${artistData.name}
- From: ${fromEmail}
- Genres: ${genres}
- Monthly Listeners: ${listeners}
- Top Tracks: ${topTracks}${bioContext}
${context ? `- Additional context: ${context}` : ""}

Your job: Find ${remaining} real, bookable targets in ${city} and write a personalized pitch for each.

Target types to research (mix based on artist's stage):
1. BANDS: Active indie/${genres} bands in ${city} who regularly play mid-size venues — pitch to co-headline or open for them. Find their booking contact or manager.
2. VENUES: Independent music venues in ${city} that book ${genres} artists at ${artistData.name}'s listener level (small-mid: 100-500 cap). Find their booking email.
3. PROMOTERS: Independent show promoters or booking agencies in ${city} who work in ${genres}.

For each target, write a SHORT pitch email (under 120 words) that:
- References something specific about that band/venue/promoter
- Makes a clear ask (co-headline, opener slot, venue booking, representation)
- Mentions ${artistData.name}'s strongest credential (listeners, top track, recent release)
- Sounds human, not templated

Return a JSON array of exactly ${remaining} objects:
[{
  "name": "Target name (band/venue/promoter)",
  "type": "band" | "venue" | "promoter" | "manager",
  "email": "booking@venue.com or realistic contact email",
  "contactName": "First name of contact if known",
  "venue": "Venue name if type is band (where they play)",
  "city": "${city}",
  "rationale": "1 sentence: why this specific target makes sense for ${artistData.name}",
  "pitchSubject": "Email subject line",
  "pitchBody": "Full email body text (plain text)"
}]

Use real venues, real bands, and realistic emails. Return ONLY the JSON array.`;

  let targets: BookingTarget[];
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: researchPrompt }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");
    targets = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Booking research error:", e);
    return NextResponse.json({ error: "Failed to research booking targets" }, { status: 500 });
  }

  // Step 2: Send each pitch email
  let sent = 0;
  let failed = 0;
  const idsKey = `outreach-ids:${artistData.id}`;
  const existingIds = (await kvGet<string[]>(idsKey)) ?? [];
  const newIds: string[] = [];

  for (const target of targets.slice(0, remaining)) {
    const result = await sendEmail({
      from: fromDisplay,
      to: target.email,
      subject: target.pitchSubject,
      text: target.pitchBody,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${target.pitchBody}</pre>`,
      replyTo: session.email,
    });

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: OutreachRecord = {
      to: target.email,
      toName: target.contactName || target.name,
      toRole: target.type === "band" ? "Band/Artist" : target.type === "venue" ? "Venue" : target.type === "promoter" ? "Promoter" : "Manager",
      toPublication: target.name,
      subject: target.pitchSubject,
      body: target.pitchBody,
      rationale: target.rationale,
      id,
      artistId: artistData.id,
      sentAt: new Date().toISOString(),
      from: fromEmail,
      status: result ? "sent" : "failed",
    };

    await kvSet(`outreach:${artistData.id}:${id}`, record);
    newIds.push(id);
    if (result) sent++; else failed++;
  }

  await kvSet(idsKey, [...newIds, ...existingIds]);
  if (sent > 0) await kvSet(countKey, currentCount + sent, 90000);

  return NextResponse.json({
    ok: true,
    city,
    targets,
    sent,
    failed,
    fromEmail,
  } as BookingOutreachResult & { ok: boolean; fromEmail: string });
}
