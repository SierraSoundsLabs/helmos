// Shared session-issuing helper used by all auth routes that need to
// log a user in: password register/login, password reset confirm, etc.
//
// Sets the session cookie and returns a redirect target appropriate
// for the user's state.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { kvGet } from "@/lib/kv";
import { encodeSession, COOKIE_NAME, TTL } from "@/lib/session";
import type { UserProfile } from "@/lib/tasks";

// Founder / operator emails that can authenticate without a paid Stripe
// subscription. Two sources:
//   1. HELM_FOUNDER_EMAILS env var (comma-separated) — normal path
//   2. FOUNDER_FALLBACK below — hardcoded backstop so a missing env var
//      can't lock the founder out of their own product
//
// This is not an "admin roles" system. It exists so support-ops (Rory)
// can log in without being a $29/mo subscriber.
const FOUNDER_FALLBACK = ["rory@goodmornmusic.com"];

export function isFounderEmail(email: string): boolean {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return false;
  const envList = (process.env.HELM_FOUNDER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return envList.includes(normalized) || FOUNDER_FALLBACK.includes(normalized);
}

/**
 * Issue a session cookie and resolve where to send the user next.
 *
 * Returning subscribers (have customerId) always go straight to /dashboard
 * — they've already completed intake. Non-subscribers (rare here, since
 * most callers gate on subscription first) go to /intake.
 */
export async function buildSessionAndRedirect(
  email: string,
  customerId: string,
  artistId: string
): Promise<NextResponse> {
  // Resolve artistId from KV if not supplied
  let resolvedArtistId = artistId;
  if (!resolvedArtistId) {
    const mapped = await kvGet<string>(
      `helm:email_artist:${email.toLowerCase()}`
    );
    if (mapped) resolvedArtistId = mapped;
  }

  const sessionToken = encodeSession({
    email,
    artistId: resolvedArtistId || "",
    customerId,
    plan: "pro",
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    maxAge: TTL,
    path: "/",
    sameSite: "lax",
  });

  let redirect = "/intake";
  if (customerId) {
    redirect = resolvedArtistId
      ? `/dashboard?artist=${resolvedArtistId}`
      : "/dashboard";
  } else if (resolvedArtistId) {
    const profile = await kvGet<UserProfile>(
      `helm:user:${resolvedArtistId}:profile`
    );
    redirect = profile
      ? `/dashboard?artist=${resolvedArtistId}`
      : `/intake?artist=${resolvedArtistId}`;
  }

  return NextResponse.json({
    ok: true,
    artistId: resolvedArtistId,
    redirect,
  });
}
