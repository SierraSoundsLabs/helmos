// TODO: For inbound email routing, Resend requires MX records on helmos.co
// pointing to Resend's inbound mail servers. Configure in Resend dashboard
// under "Inbound" settings, then add MX records to your DNS provider.
// Resend inbound MX: inbound.resend.com (priority 10)

import { NextRequest } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

export interface InboundEmail {
  id: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
  receivedAt: string;
}

function verifyResendSignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature.replace("sha256=", ""), "hex")
  );
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify webhook signature if secret is configured
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get("resend-signature") || req.headers.get("svix-signature") || "";
    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }
    try {
      if (!verifyResendSignature(rawBody, sig, secret)) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401, headers: { "Content-Type": "application/json" },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: "Signature verification failed" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // Resend inbound webhook shape
  const data = (payload.data as Record<string, unknown>) ?? payload;
  const fromRaw = (data.from as string) ?? "";
  const toRaw = (data.to as string) ?? "";
  const subject = (data.subject as string) ?? "(no subject)";
  const text = (data.text as string) ?? "";
  const html = (data.html as string) ?? undefined;

  // Parse "Name <email>" format
  const fromMatch = fromRaw.match(/^(.+?)\s*<([^>]+)>/) ?? [];
  const fromName = fromMatch[1]?.trim() ?? fromRaw;
  const from = fromMatch[2]?.trim() ?? fromRaw;

  // Extract artist slug from the "to" address (e.g. jiwon@helmos.co -> jiwon)
  const toAddress = Array.isArray(toRaw) ? (toRaw as string[])[0] : toRaw;
  const slugMatch = toAddress.match(/^([^@]+)@helmos\.co/i);
  const artistSlug = slugMatch?.[1]?.toLowerCase() ?? "unknown";

  const headers = (data.headers as Record<string, string>) ?? {};
  const inReplyTo = headers["in-reply-to"] ?? (data.inReplyTo as string) ?? undefined;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const inbound: InboundEmail = {
    id,
    from,
    fromName,
    to: toAddress,
    subject,
    text,
    html,
    inReplyTo,
    receivedAt: new Date().toISOString(),
  };

  // Store email
  await kvSet(`inbox:${artistSlug}:${id}`, inbound);

  // Track IDs list for this artist
  const idsKey = `inbox-ids:${artistSlug}`;
  const existing = (await kvGet<string[]>(idsKey)) ?? [];
  await kvSet(idsKey, [...existing, id]);

  // Task 4 — forward to the artist's real email so they actually see it.
  // The slug→email mapping is written by /api/helm/onesheet/publish and
  // any future flow that knows the artist's real email.
  const artistRealEmail = await kvGet<string>(`helm:slug_email:${artistSlug}`);
  if (artistRealEmail) {
    try {
      const subjectLine = `[Helm] ${subject}`;
      const headerBlock =
        `Sent to your manager email (${toAddress})\n` +
        `From: ${fromName ? `${fromName} <${from}>` : from}\n` +
        `Reply to this email to respond directly to the sender.\n` +
        `────────────────────────────────────────\n\n`;
      await sendEmail({
        to: artistRealEmail,
        from: `Helm Manager <${toAddress}>`,
        replyTo: from,
        subject: subjectLine,
        text: headerBlock + text,
        html: html
          ? `<div style="font-family:sans-serif;color:#666;font-size:13px;border-bottom:1px solid #eee;padding-bottom:12px;margin-bottom:16px">
               Sent to your manager email (<strong>${toAddress}</strong>)<br/>
               From: ${fromName ? `${fromName} &lt;${from}&gt;` : from}<br/>
               <em>Reply to this email to respond directly to the sender.</em>
             </div>${html}`
          : headerBlock.replace(/\n/g, "<br/>") + text.replace(/\n/g, "<br/>"),
        headers: inReplyTo ? { "In-Reply-To": inReplyTo } : undefined,
      });
    } catch (err) {
      console.error("inbound forward failed", err);
      // Non-fatal — email is still stored in KV inbox for retrieval
    }
  }

  return new Response(JSON.stringify({ ok: true, id }), {
    headers: { "Content-Type": "application/json" },
  });
}
