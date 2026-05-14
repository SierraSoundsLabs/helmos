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
  read?: boolean;
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

  // Notification-only forwarding to the artist's real email.
  //
  // Privacy design: we DO NOT include the full email body or set Reply-To.
  // If we forwarded full content with Reply-To set, the artist replying
  // from their own mail client would leak their real From: address to the
  // outside sender. Instead, we send a short notification with a link to
  // the Helm inbox where the artist can read and reply via slug@helmos.co
  // (their real email is never exposed to outsiders).
  const artistRealEmail = await kvGet<string>(`helm:slug_email:${artistSlug}`);
  if (artistRealEmail) {
    try {
      const senderLabel = fromName ? `${fromName} <${from}>` : from;
      const previewLine = text.split(/\n/).map(s => s.trim()).filter(Boolean)[0]?.slice(0, 120) ?? "";
      const inboxUrl = `https://helmos.co/dashboard?tab=outreach#inbox`;

      await sendEmail({
        to: artistRealEmail,
        from: `Helm <noreply@helmos.co>`,
        subject: `[Helm] New message from ${fromName || from}`,
        text: [
          `You have a new message in your Helm inbox.`,
          ``,
          `From: ${senderLabel}`,
          `Subject: ${subject}`,
          previewLine ? `Preview: ${previewLine}…` : ``,
          ``,
          `Open in Helm: ${inboxUrl}`,
          ``,
          `Reply from inside Helm — your real email stays private.`,
          ``,
          `— Helm`,
        ].filter(Boolean).join("\n"),
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222">
            <p style="font-size:14px;color:#666;margin:0 0 16px">You have a new message in your Helm inbox.</p>
            <div style="background:#f7f7fb;border:1px solid #e5e5ee;border-radius:8px;padding:16px;margin-bottom:20px">
              <p style="font-size:13px;color:#666;margin:0 0 4px">From: <strong style="color:#222">${senderLabel.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong></p>
              <p style="font-size:13px;color:#666;margin:0 0 8px">Subject: <strong style="color:#222">${subject.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong></p>
              ${previewLine ? `<p style="font-size:13px;color:#444;margin:0;font-style:italic">"${previewLine.replace(/</g, "&lt;").replace(/>/g, "&gt;")}…"</p>` : ""}
            </div>
            <a href="${inboxUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">Open in Helm →</a>
            <p style="font-size:12px;color:#888;margin:20px 0 0">Reply from inside Helm — your real email stays private.</p>
          </div>`,
      });
    } catch (err) {
      console.error("inbound notification failed", err);
      // Non-fatal — email is still stored in KV inbox for retrieval
    }
  }

  return new Response(JSON.stringify({ ok: true, id }), {
    headers: { "Content-Type": "application/json" },
  });
}
