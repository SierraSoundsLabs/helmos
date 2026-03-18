import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { sendEmail, artistEmail } from "@/lib/email";
import { kvGet, kvSet } from "@/lib/kv";

interface ReplyRecord {
  id: string;
  artistSlug: string;
  to: string;
  subject: string;
  body: string;
  from: string;
  inReplyToId?: string;
  sentAt: string;
  status: "sent" | "failed";
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { artistSlug, to, subject, body, inReplyToId }: {
    artistSlug: string;
    to: string;
    subject: string;
    body: string;
    inReplyToId?: string;
  } = await req.json();

  if (!artistSlug || !to || !subject || !body) {
    return new Response(JSON.stringify({ error: "artistSlug, to, subject, body required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const fromEmail = artistEmail(artistSlug);
  const headers: Record<string, string> = {};
  if (inReplyToId) {
    headers["In-Reply-To"] = inReplyToId;
    headers["References"] = inReplyToId;
  }

  const result = await sendEmail({
    from: fromEmail,
    to,
    subject,
    text: body,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${body}</pre>`,
    headers,
  });

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record: ReplyRecord = {
    id,
    artistSlug,
    to,
    subject,
    body,
    from: fromEmail,
    inReplyToId,
    sentAt: new Date().toISOString(),
    status: result ? "sent" : "failed",
  };

  // Store reply record
  await kvSet(`reply:${artistSlug}:${id}`, record);

  // Track reply IDs
  const idsKey = `reply-ids:${artistSlug}`;
  const existing = (await kvGet<string[]>(idsKey)) ?? [];
  await kvSet(idsKey, [...existing, id]);

  if (!result) {
    return new Response(JSON.stringify({ error: "Failed to send email", record }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: result.id, record }), {
    headers: { "Content-Type": "application/json" },
  });
}
