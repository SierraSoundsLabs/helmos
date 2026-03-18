import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { sendEmail, artistEmail, toSlug } from "@/lib/email";
import { kvGet, kvSet } from "@/lib/kv";
import type { OutreachDraft } from "@/app/api/helm/outreach/generate/route";

export interface OutreachRecord extends OutreachDraft {
  id: string;
  artistId: string;
  sentAt: string;
  from: string;
  status: "sent" | "failed";
}

const MAX_PER_DAY = 10;

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { artistId, artistName, drafts }: {
    artistId: string;
    artistName: string;
    drafts: OutreachDraft[];
  } = await req.json();

  if (!artistId || !Array.isArray(drafts) || drafts.length === 0) {
    return new Response(JSON.stringify({ error: "artistId and drafts required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // Check daily count
  const today = new Date().toISOString().split("T")[0];
  const countKey = `outreach-count:${artistId}:${today}`;
  const currentCount = (await kvGet<number>(countKey)) ?? 0;

  const remaining = MAX_PER_DAY - currentCount;
  if (remaining <= 0) {
    return new Response(JSON.stringify({ error: "Daily limit of 10 emails reached", sent: 0, failed: 0 }), {
      status: 429, headers: { "Content-Type": "application/json" },
    });
  }

  const toSend = drafts.slice(0, remaining);
  const slug = toSlug(artistName || artistId);
  const fromEmail = artistEmail(slug);
  const fromDisplay = `${artistName || slug} <${fromEmail}>`;

  let sent = 0;
  let failed = 0;

  // Load existing IDs list
  const idsKey = `outreach-ids:${artistId}`;
  const existingIds = (await kvGet<string[]>(idsKey)) ?? [];
  const newIds: string[] = [];

  for (const draft of toSend) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await sendEmail({
      from: fromDisplay,
      to: draft.to,
      subject: draft.subject,
      text: draft.body,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${draft.body}</pre>`,
    });

    const record: OutreachRecord = {
      ...draft,
      id,
      artistId,
      sentAt: new Date().toISOString(),
      from: fromEmail,
      status: result ? "sent" : "failed",
    };

    await kvSet(`outreach:${artistId}:${id}`, record);
    newIds.push(id);

    if (result) {
      sent++;
    } else {
      failed++;
    }
  }

  // Update IDs list and daily count
  await kvSet(idsKey, [...existingIds, ...newIds]);
  await kvSet(countKey, currentCount + sent, 90000); // expire after ~25 hours

  return new Response(JSON.stringify({ sent, failed, remaining: remaining - sent }), {
    headers: { "Content-Type": "application/json" },
  });
}
