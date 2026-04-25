import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { sendEmail, artistEmail, toSlug } from "@/lib/email";
import { kvGet, kvSet } from "@/lib/kv";
import type { ArtistData } from "@/lib/spotify";
import type { OutreachRecord } from "@/app/api/helm/outreach/send/route";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Generate and immediately send a targeted outreach email from chat context
// Used when the chat bot is asked to send an email to a specific person/address
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.paid) return NextResponse.json({ error: "Subscription required" }, { status: 403 });

  const { artistData, toEmail, toName, context }: {
    artistData: ArtistData;
    toEmail: string;
    toName?: string;
    context?: string; // extra instructions from the user's chat message
  } = await req.json();

  if (!artistData || !toEmail) {
    return NextResponse.json({ error: "artistData and toEmail required" }, { status: 400 });
  }

  // Check daily send limit
  const today = new Date().toISOString().split("T")[0];
  const countKey = `outreach-count:${artistData.id}:${today}`;
  const currentCount = (await kvGet<number>(countKey)) ?? 0;
  const MAX_PER_DAY = 10;
  if (currentCount >= MAX_PER_DAY) {
    return NextResponse.json({ error: "Daily limit of 10 emails reached" }, { status: 429 });
  }

  const slug = toSlug(artistData.name);
  const fromEmail = artistEmail(slug);
  const fromDisplay = `${artistData.name} <${fromEmail}>`;

  const releaseList = (artistData.allReleases || []).slice(0, 5)
    .map(r => `${r.name} (${r.type}, ${r.releaseDate})`).join(", ");
  const topTracks = (artistData.topTracks || []).slice(0, 3).map(t => t.name).join(", ");

  const prompt = `You are a music industry outreach specialist writing on behalf of ${artistData.name}.

ARTIST:
- Name: ${artistData.name}
- Genres: ${(artistData.genres || []).join(", ") || "Unknown"}
- Monthly Listeners: ${artistData.monthlyListenersFormatted || "—"}
- Top Tracks: ${topTracks || "—"}
- Recent Releases: ${releaseList || "None"}

RECIPIENT: ${toName ? `${toName} <${toEmail}>` : toEmail}
${context ? `USER INSTRUCTIONS: ${context}` : ""}

Write a concise, professional outreach email FROM ${artistData.name} (${fromEmail}) TO ${toName || toEmail}.
- Under 150 words
- Specific ask (pitch the music, request a meeting, request consideration, etc.)
- Sound human and genuine
- Reference the recipient by name if provided

Return a JSON object with:
{
  "subject": "Email subject line",
  "body": "Full email body text (plain text)",
  "toName": "Recipient name or best guess from email",
  "toRole": "Best guess at their role (e.g. Music Blogger, A&R, Playlist Curator)"
}

Return ONLY the JSON object, no other text.`;

  let draft: { subject: string; body: string; toName: string; toRole: string };
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    draft = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("chat-send generate error:", e);
    return NextResponse.json({ error: "Failed to generate email" }, { status: 500 });
  }

  // Send via Resend
  const result = await sendEmail({
    from: fromDisplay,
    to: toEmail,
    subject: draft.subject,
    text: draft.body,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${draft.body}</pre>`,
    replyTo: session.email,
  });

  const status: "sent" | "failed" = result ? "sent" : "failed";

  // Save to outreach history
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record: OutreachRecord = {
    to: toEmail,
    toName: draft.toName || toName || toEmail,
    toRole: draft.toRole || "Contact",
    subject: draft.subject,
    body: draft.body,
    rationale: context || "Sent via AI chat",
    id,
    artistId: artistData.id,
    sentAt: new Date().toISOString(),
    from: fromEmail,
    status,
  };

  const idsKey = `outreach-ids:${artistData.id}`;
  const existingIds = (await kvGet<string[]>(idsKey)) ?? [];
  await kvSet(`outreach:${artistData.id}:${id}`, record);
  await kvSet(idsKey, [id, ...existingIds]);
  if (status === "sent") {
    await kvSet(countKey, currentCount + 1, 90000);
  }

  return NextResponse.json({
    status,
    to: toEmail,
    subject: draft.subject,
    body: draft.body,
    fromEmail,
    record,
  });
}
