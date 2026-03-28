import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { kvGet, kvSet } from "@/lib/kv";
import { encodeSession, COOKIE_NAME, TTL } from "@/lib/session";
import { findStripeCustomer } from "@/lib/stripe";
import type { UserProfile } from "@/lib/tasks";

interface PasswordRecord {
  salt: string;
  hash: string;
}

function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256 // 32 bytes
  );
  return hexEncode(bits);
}

async function buildSessionAndRedirect(
  email: string,
  customerId: string,
  artistId: string
): Promise<NextResponse> {
  // Resolve artistId from KV if not set
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
  if (resolvedArtistId) {
    const profile = await kvGet<UserProfile>(
      `helm:user:${resolvedArtistId}:profile`
    );
    redirect = profile
      ? `/dashboard?artist=${resolvedArtistId}`
      : `/intake?artist=${resolvedArtistId}`;
  }

  return NextResponse.json({ ok: true, artistId: resolvedArtistId, redirect });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (action !== "register" && action !== "login") {
    return NextResponse.json(
      { error: 'Action must be "register" or "login"' },
      { status: 400 }
    );
  }

  const kvKey = `helm:password:${email}`;

  try {
    if (action === "register") {
      const existing = await kvGet<PasswordRecord>(kvKey);
      if (existing) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 }
        );
      }

      // Find Stripe customer — must have active subscription to register
      const customer = await findStripeCustomer(email);
      if (!customer) {
        return NextResponse.json(
          {
            error:
              "No active subscription found for this email. Please subscribe first.",
            code: "no_subscription",
          },
          { status: 403 }
        );
      }

      // Hash and store password
      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      const salt = hexEncode(saltBytes.buffer);
      const hash = await hashPassword(password, salt);
      await kvSet(kvKey, { salt, hash } satisfies PasswordRecord);

      return buildSessionAndRedirect(
        email,
        customer.customerId,
        customer.artistId
      );
    }

    // action === "login"
    const record = await kvGet<PasswordRecord>(kvKey);
    if (!record) {
      return NextResponse.json(
        { error: "No account found with this email. Please create an account." },
        { status: 401 }
      );
    }

    const hash = await hashPassword(password, record.salt);
    if (hash !== record.hash) {
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: 401 }
      );
    }

    const customer = await findStripeCustomer(email);
    if (!customer) {
      return NextResponse.json(
        {
          error:
            "No active subscription found for this email. Please subscribe first.",
          code: "no_subscription",
        },
        { status: 403 }
      );
    }

    return buildSessionAndRedirect(
      email,
      customer.customerId,
      customer.artistId
    );
  } catch (err) {
    console.error("password auth error", err);
    return NextResponse.json(
      { error: "Authentication failed. Please try again." },
      { status: 500 }
    );
  }
}
