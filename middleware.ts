import { NextRequest, NextResponse } from "next/server";
import { encodeSession, COOKIE_NAME, TTL, decodeSession } from "@/lib/session";

// Dev auto-login: only runs in non-production environments.
// Sets a permanent paid session so you never have to log in during local dev or Vercel preview.
const DEV_SESSION = {
  email: "dev@helmos.co",
  artistId: "dev-artist",
  customerId: "cus_dev",
  plan: "pro" as const,
};

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.next();

  // Skip API auth routes and static assets
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const existing = req.cookies.get(COOKIE_NAME)?.value;
  if (existing && decodeSession(existing)) return NextResponse.next();

  // No valid session — auto-set a dev paid session
  const token = encodeSession(DEV_SESSION);
  const res = NextResponse.next();
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false,
    maxAge: TTL,
    path: "/",
    sameSite: "lax",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
