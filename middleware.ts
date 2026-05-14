import { NextResponse } from "next/server";

// Middleware runs on Edge runtime — no Node APIs (crypto, Buffer, etc.) allowed.
//
// Previously we set a permanent dev paid session here so `npm run dev` would
// "just work" without logging in. That code called `encodeSession()` which uses
// Node `crypto.createHmac()` and crashed every page locally with a 500 error.
// Production was unaffected (the function short-circuited there), but local
// development was effectively broken.
//
// The dev-auto-login also used fake values (`dev-artist` Spotify ID, `cus_dev`
// Stripe customer) that couldn't load real data anyway. The right local-dev
// workflow is the real login flow: forgot-password → email link → set password.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
