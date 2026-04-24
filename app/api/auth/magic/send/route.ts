import { NextRequest, NextResponse } from "next/server";
import { kvSet, kvGet } from "@/lib/kv";
import { sendEmail } from "@/lib/email";
import { findStripeCustomer } from "@/lib/stripe";
import crypto from "crypto";

const MAGIC_LINK_TTL = 900; // 15 minutes

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    const customer = await findStripeCustomer(email);

    // Always return ok — don't reveal if email exists (security best practice)
    if (!customer) {
      return NextResponse.json({ ok: true });
    }

    // Check for artist override in KV (allows changing artist without new Stripe session)
    const overrideKey = `artist_override:${customer.customerId}`;
    const override = await kvGet<{ artistId: string }>(overrideKey);
    if (override?.artistId) {
      customer.artistId = override.artistId;
    }

    // Generate secure one-time token
    const token = crypto.randomBytes(32).toString("hex");
    const key = `magic:${token}`;

    await kvSet(key, { email, artistId: customer.artistId, customerId: customer.customerId }, MAGIC_LINK_TTL);

    // Use request origin so magic links work on preview deployments too
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const magicUrl = `${baseUrl}/api/auth/magic/verify?token=${token}`;

    await sendEmail({
      to: email,
      from: "signin@helmos.co",
      subject: "Your Helmos login link",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
              <tr><td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:40px;">
                  <tr><td>
                    <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#fff;">Log in to Helmos</p>
                    <p style="margin:0 0 32px;font-size:15px;color:#888;">Click the button below to sign in. This link expires in 15 minutes.</p>
                    <a href="${magicUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">Sign In to Helmos</a>
                    <p style="margin:32px 0 0;font-size:13px;color:#555;">If you didn't request this, you can safely ignore this email.<br/>Link expires in 15 minutes and can only be used once.</p>
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </body>
        </html>
      `,
      text: `Log in to Helmos\n\nClick this link to sign in (expires in 15 minutes):\n${magicUrl}\n\nIf you didn't request this, ignore this email.`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("magic/send error", err);
    return NextResponse.json({ error: "Failed to send login link" }, { status: 500 });
  }
}
