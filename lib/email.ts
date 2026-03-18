// Email utility using Resend API
// RESEND_API_KEY env var required
// Domain: helmos.co must have Resend DNS records configured

export interface EmailMessage {
  to: string;
  from: string;    // e.g. "jiwon@helmos.co"
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export async function sendEmail(msg: EmailMessage): Promise<{ id: string } | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not configured");
    return null;
  }

  try {
    const body: Record<string, unknown> = {
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    };
    if (msg.replyTo) body.reply_to = msg.replyTo;
    if (msg.headers) body.headers = msg.headers;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", res.status, err);
      return null;
    }

    const data = await res.json();
    return { id: data.id };
  } catch (e) {
    console.error("sendEmail failed:", e);
    return null;
  }
}

export function artistEmail(artistSlug: string): string {
  return `${artistSlug}@helmos.co`;
}

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
