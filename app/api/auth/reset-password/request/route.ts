import { NextRequest, NextResponse } from "next/server";
import { kvSet } from "@/lib/kv";
import { sendEmail } from "@/lib/email";
import { findStripeCustomer } from "@/lib/stripe";
import crypto from "crypto";

const RESET_TOKEN_TTL = 3600; // 1 hour

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    const customer = await findStripeCustomer(email);

    // Don't reveal whether the email belongs to a subscriber — always return ok.
    // No-op silently if there's no matching customer.
    if (!customer) {
      return NextResponse.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const key = `helm:reset_token:${token}`;
    await kvSet(key, { email }, RESET_TOKEN_TTL);

    // Use request origin so reset links work on preview deployments too
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendEmail({
      to: email,
      from: "signin@helmos.co",
      subject: "Set your Helm password",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
              <tr><td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:40px;">
                  <tr><td>
                    <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#fff;">Set your Helm password</p>
                    <p style="margin:0 0 32px;font-size:15px;color:#888;">Click the button below to set or reset your password. This link expires in 1 hour.</p>
                    <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">Set Your Password</a>
                    <p style="margin:32px 0 0;font-size:13px;color:#555;">If you didn't request this, you can safely ignore this email.<br/>Link expires in 1 hour and can only be used once.</p>
                    <p style="margin:24px 0 0;font-size:12px;color:#666;">Need help? <a href="mailto:support@helmos.co" style="color:#a5b4fc;text-decoration:none;">support@helmos.co</a></p>
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </body>
        </html>
      `,
      text: `Set your Helm password\n\nClick this link to set or reset your password (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n\nNeed help? support@helmos.co`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reset-password/request error", err);
    return NextResponse.json({ error: "Failed to send reset link" }, { status: 500 });
  }
}
