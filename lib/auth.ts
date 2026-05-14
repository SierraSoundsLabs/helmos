// Shared session-issuing helper used by all auth routes that need to
// log a user in: password register/login, password reset confirm,
// magic-link verify, etc.
//
// Sets the session cookie and returns a redirect target appropriate
// for the user's state.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { kvGet } from "@/lib/kv";
import { encodeSession, COOKIE_NAME, TTL } from "@/lib/session";
import type { UserProfile } from "@/lib/tasks";

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
