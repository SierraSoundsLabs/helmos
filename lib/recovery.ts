// Win-back drip — server-side helpers for the abandoned-checkout email
// sequence (Helm-branded, complement to Stripe's built-in 1-hour recovery).
//
// Storage: per-email KV record at `helm:recovery:{email}` tracking which
// touches have been sent. The Stripe webhook seeds the record on
// `checkout.session.expired`, the daily cron sends the T+3d and T+7d
// follow-ups, the unsubscribe endpoint marks the record opted-out, and
// `customer.subscription.created` flips `converted: true` so future
// cron sweeps skip.

import crypto from "crypto";
import { kvGet, kvSet, kvKeys } from "@/lib/kv";
import { sendEmail } from "@/lib/email";

// 90 days — long enough that a late conversion is still trackable, short
// enough to clean up dead records eventually.
const RECOVERY_TTL_SECONDS = 60 * 60 * 24 * 90;

export interface RecoveryRecord {
  email: string;
  startedAt: string;             // ISO — when the abandoned-checkout signal arrived
  checkoutSessionId?: string;
  sentT0?: string | null;        // ISO — first touch (immediate on session.expired)
  sentT3d?: string | null;       // ISO
  sentT7d?: string | null;       // ISO
  converted?: boolean;
  convertedAt?: string | null;
  unsubscribed?: boolean;
  unsubscribedAt?: string | null;
  unsubscribeToken: string;
}

function recoveryKey(email: string) {
  return `helm:recovery:${email.toLowerCase()}`;
}

export async function getRecoveryRecord(email: string): Promise<RecoveryRecord | null> {
  return await kvGet<RecoveryRecord>(recoveryKey(email));
}

export async function saveRecoveryRecord(r: RecoveryRecord): Promise<void> {
  await kvSet(recoveryKey(r.email), r, RECOVERY_TTL_SECONDS);
}

export async function listRecoveryEmails(): Promise<string[]> {
  const keys = await kvKeys("helm:recovery:*");
  return keys.map((k) => k.slice("helm:recovery:".length));
}

export async function markConverted(email: string): Promise<void> {
  const r = await getRecoveryRecord(email);
  if (!r) return;
  r.converted = true;
  r.convertedAt = new Date().toISOString();
  await saveRecoveryRecord(r);
}

export async function markUnsubscribed(email: string, token: string): Promise<boolean> {
  const r = await getRecoveryRecord(email);
  if (!r) return false;
  if (r.unsubscribeToken !== token) return false;
  r.unsubscribed = true;
  r.unsubscribedAt = new Date().toISOString();
  await saveRecoveryRecord(r);
  return true;
}

// ── Email composers ──────────────────────────────────────────────────────

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://helmos.co").replace(/\/$/, "");
const PAYMENT_LINK = process.env.STRIPE_PRO_PAYMENT_LINK || "https://helmos.co/";
const PROMO_CODE = "WELCOME50";

function paymentLinkWithPromo(): string {
  // Stripe payment links accept ?prefilled_promo_code=… to surface the
  // promo on the hosted checkout. Falls back gracefully if the param is
  // ignored.
  const join = PAYMENT_LINK.includes("?") ? "&" : "?";
  return `${PAYMENT_LINK}${join}prefilled_promo_code=${PROMO_CODE}`;
}

function unsubscribeUrl(email: string, token: string): string {
  return `${BASE_URL}/api/recovery/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

function shell({ preheader, body, unsubUrl }: { preheader: string; body: string; unsubUrl: string }): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <span style="display:none;color:#0a0a0a;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:32px;max-width:520px;">
        <tr><td>
          <div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px"><span style="color:#fff;font-weight:700;font-size:18px;">H</span></div>
          ${body}
        </td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:11px;color:#555;max-width:520px;text-align:center;line-height:1.6;">
        You're receiving this because you started signing up for Helm. <a href="${unsubUrl}" style="color:#777;text-decoration:underline;">Unsubscribe</a><br/>
        Sierra Sounds LLC, d/b/a Helm · helmos.co
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function ctaButton(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:14px 26px;border-radius:8px;font-size:15px;font-weight:600;margin:8px 0">${label}</a>`;
}

interface EmailTouch {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

function touchT0(email: string, token: string): EmailTouch {
  const link = PAYMENT_LINK;
  const unsub = unsubscribeUrl(email, token);
  const subject = "You almost set up Helm — want to finish?";
  const preheader = "Your trial is still available. One click to resume.";
  const html = shell({ preheader, unsubUrl: unsub, body: `
    <p style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">You almost set up Helm.</p>
    <p style="margin:0 0 20px;font-size:15px;color:#ccc;line-height:1.6;">We saw you started signing up but didn't finish. Your trial is still available — and the first <strong>3 days are on us</strong>.</p>
    <p style="margin:0 0 8px;font-size:14px;color:#aaa;line-height:1.6;">In your first session Helm will:</p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#ccc;line-height:1.7;">
      <li>Pull your Spotify profile + analyze your career stage</li>
      <li>Write a real artist bio (interview-crafted, 3 lengths)</li>
      <li>Publish your one-sheet at <span style="font-family:ui-monospace,Menlo,monospace;color:#a5b4fc">helmos.co/{you}</span></li>
      <li>Pitch 10 real, verified press contacts in your genre</li>
    </ul>
    ${ctaButton("Resume your trial →", link)}
    <p style="margin:24px 0 0;font-size:13px;color:#777;">— Helm</p>
  ` });
  const text = `You almost set up Helm.

We saw you started signing up but didn't finish. Your trial is still available — and the first 3 days are on us.

In your first session Helm will:
- Pull your Spotify profile + analyze your career stage
- Write a real artist bio (interview-crafted, 3 lengths)
- Publish your one-sheet at helmos.co/{you}
- Pitch 10 real, verified press contacts in your genre

Resume your trial: ${link}

— Helm

Unsubscribe: ${unsub}
Sierra Sounds LLC, d/b/a Helm`;
  return { subject, preheader, html, text };
}

function touchT3d(email: string, token: string): EmailTouch {
  const link = PAYMENT_LINK;
  const unsub = unsubscribeUrl(email, token);
  const subject = "Here's what Helm would have done for you this week";
  const preheader = "3 days in, here's what the AI would have shipped.";
  const html = shell({ preheader, unsubUrl: unsub, body: `
    <p style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">3 days. Here's what would already be done.</p>
    <p style="margin:0 0 20px;font-size:15px;color:#ccc;line-height:1.6;">If you'd activated Helm earlier this week, by now you'd have:</p>
    <div style="background:#0d0d0d;border:1px solid #1e1e1e;border-radius:8px;padding:16px;margin:0 0 20px">
      <p style="margin:0 0 8px;font-size:14px;color:#ddd"><strong style="color:#a5b4fc">📄 A published one-sheet</strong> at <span style="font-family:ui-monospace,Menlo,monospace;color:#a5b4fc">helmos.co/{you}</span> — share with press &amp; bookings.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#ddd"><strong style="color:#a5b4fc">✍️ A real artist bio</strong> in three lengths, saved to your dashboard.</p>
      <p style="margin:0 0 8px;font-size:14px;color:#ddd"><strong style="color:#a5b4fc">📰 10 verified press contacts</strong> pitched on your latest release.</p>
      <p style="margin:0;font-size:14px;color:#ddd"><strong style="color:#a5b4fc">📬 Replies routing back</strong> to your dashboard inbox.</p>
    </div>
    <p style="margin:0 0 20px;font-size:14px;color:#aaa;line-height:1.6;">Your 3-day free trial is still here. Pick up where you left off.</p>
    ${ctaButton("Start your trial →", link)}
    <p style="margin:24px 0 0;font-size:13px;color:#777;">— Helm</p>
  ` });
  const text = `3 days. Here's what would already be done.

If you'd activated Helm earlier this week, by now you'd have:

- A published one-sheet at helmos.co/{you} — share with press & bookings.
- A real artist bio in three lengths, saved to your dashboard.
- 10 verified press contacts pitched on your latest release.
- Replies routing back to your dashboard inbox.

Your 3-day free trial is still here. Pick up where you left off.

Start your trial: ${link}

— Helm

Unsubscribe: ${unsub}
Sierra Sounds LLC, d/b/a Helm`;
  return { subject, preheader, html, text };
}

function touchT7d(email: string, token: string): EmailTouch {
  const link = paymentLinkWithPromo();
  const unsub = unsubscribeUrl(email, token);
  const subject = `Last call — 50% off your first month with ${PROMO_CODE}`;
  const preheader = "One-time offer. Use code WELCOME50.";
  const html = shell({ preheader, unsubUrl: unsub, body: `
    <p style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;">Last call.</p>
    <p style="margin:0 0 20px;font-size:15px;color:#ccc;line-height:1.6;">Use code <strong style="color:#a5b4fc;font-family:ui-monospace,Menlo,monospace">${PROMO_CODE}</strong> for <strong>50% off your first month</strong> of Helm. This is the last note from us — promise.</p>
    <div style="background:#0d0d0d;border:1px solid #6366f1/40;border-radius:8px;padding:16px;margin:0 0 24px;text-align:center">
      <p style="margin:0 0 4px;font-size:11px;color:#a5b4fc;letter-spacing:.06em;text-transform:uppercase;font-weight:600">Your code</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:#fff;font-family:ui-monospace,Menlo,monospace;letter-spacing:.04em">${PROMO_CODE}</p>
    </div>
    ${ctaButton("Subscribe with " + PROMO_CODE + " →", link)}
    <p style="margin:20px 0 0;font-size:13px;color:#777;line-height:1.6;">If Helm isn't for you, no worries — we won't email you about this again.<br/>— Helm</p>
  ` });
  const text = `Last call.

Use code ${PROMO_CODE} for 50% off your first month of Helm. This is the last note from us — promise.

Subscribe with ${PROMO_CODE}: ${link}

If Helm isn't for you, no worries — we won't email you about this again.

— Helm

Unsubscribe: ${unsub}
Sierra Sounds LLC, d/b/a Helm`;
  return { subject, preheader, html, text };
}

// ── Send orchestration ──────────────────────────────────────────────────

const FROM = "Helm <hello@helmos.co>";
const REPLY_TO = "support@helmos.co";

async function deliverTouch(email: string, touch: EmailTouch): Promise<boolean> {
  const result = await sendEmail({
    from: FROM,
    to: email,
    replyTo: REPLY_TO,
    subject: touch.subject,
    html: touch.html,
    text: touch.text,
  });
  return result !== null;
}

// Seed a recovery record (called from the Stripe webhook on checkout
// session expired). Idempotent: if a record already exists, do nothing.
// Returns the record (existing or new). Also fires the T+0 touch if this
// is the first time we've seen the email.
export async function startRecoveryFlow(opts: {
  email: string;
  checkoutSessionId?: string;
}): Promise<RecoveryRecord | null> {
  if (!opts.email || !opts.email.includes("@")) return null;
  const email = opts.email.toLowerCase();
  const existing = await getRecoveryRecord(email);
  if (existing) return existing;

  const token = crypto.randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  const record: RecoveryRecord = {
    email,
    startedAt: now,
    checkoutSessionId: opts.checkoutSessionId,
    sentT0: null,
    sentT3d: null,
    sentT7d: null,
    converted: false,
    unsubscribed: false,
    unsubscribeToken: token,
  };

  // Fire the T+0 touch immediately. (Stripe's session.expired event fires
  // ~24h after session creation by default; this is therefore not a
  // 1-hour nudge — Stripe's built-in recovery covers that gap.)
  try {
    const ok = await deliverTouch(email, touchT0(email, token));
    if (ok) record.sentT0 = now;
  } catch (err) {
    console.error("recovery T0 send failed", err);
  }

  await saveRecoveryRecord(record);
  return record;
}

// Called from the daily cron. Walks every active recovery record and
// fires T+3d / T+7d touches when their windows open. Skips records that
// are converted, unsubscribed, or whose touches were already sent.
export async function runRecoveryCron(): Promise<{
  scanned: number;
  sentT3d: number;
  sentT7d: number;
}> {
  const emails = await listRecoveryEmails();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let sentT3d = 0;
  let sentT7d = 0;

  for (const email of emails) {
    const r = await getRecoveryRecord(email);
    if (!r) continue;
    if (r.converted || r.unsubscribed) continue;
    const startedMs = new Date(r.startedAt).getTime();
    const age = now - startedMs;

    // T+3 days window — fire once between day 3 and day 7.
    if (!r.sentT3d && age >= 3 * day && age < 7 * day) {
      const ok = await deliverTouch(email, touchT3d(email, r.unsubscribeToken));
      if (ok) {
        r.sentT3d = new Date().toISOString();
        await saveRecoveryRecord(r);
        sentT3d++;
      }
    }

    // T+7 days window — final touch, fire once between day 7 and day 14.
    if (!r.sentT7d && age >= 7 * day && age < 14 * day) {
      const ok = await deliverTouch(email, touchT7d(email, r.unsubscribeToken));
      if (ok) {
        r.sentT7d = new Date().toISOString();
        await saveRecoveryRecord(r);
        sentT7d++;
      }
    }
  }

  return { scanned: emails.length, sentT3d, sentT7d };
}
