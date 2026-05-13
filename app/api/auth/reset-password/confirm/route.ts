import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { kvGet, kvSet, kvDel } from "@/lib/kv";
import { encodeSession, COOKIE_NAME, TTL } from "@/lib/session";
import { findStripeCustomer } from "@/lib/stripe";
import type { UserProfile } from "@/lib/tasks";

interface ResetTokenData {
  email: string;
}

interface PasswordRecord {
  salt: string;
  hash: string;
}

// NOTE: hashPassword + hexEncode are duplicated from app/api/auth/password/route.ts.
// Consider extracting to a shared lib/password.ts in a follow-up — see ENGINEERING-LOG.md.
function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
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
    256
  );
  return hexEncode(bits);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json(
      { error: "Invalid reset link." },
      { status: 400 }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  try {
    const tokenKey = `helm:reset_token:${token}`;
    const data = await kvGet<ResetTokenData>(tokenKey);
    if (!data) {
      return NextResponse.json(
        { error: "This link has expired or already been used. Request a new one." },
        { status: 400 }
      );
    }

    const email = data.email.trim().toLowerCase();

    // Hash and store the new password — overwrites any existing record
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = hexEncode(saltBytes.buffer);
    const hash = await hashPassword(password, salt);
    await kvSet(`helm:password:${email}`, { salt, hash } satisfies PasswordRecord);

    // Consume the token — one-time use
    await kvDel(tokenKey);

    // Look up Stripe customer to build a session
    const customer = await findStripeCustomer(email);
    if (!customer) {
      // Edge case: subscription was canceled between request and confirm.
      // Password is set, but no session.
      return NextResponse.json(
        {
          error: "Password set, but your subscription is no longer active. Please subscribe to sign in.",
          code: "no_subscription",
        },
        { status: 403 }
      );
    }

    // Resolve artistId — prefer Stripe metadata, fall back to KV mapping
    let resolvedArtistId = customer.artistId;
    if (!resolvedArtistId) {
      const mapped = await kvGet<string>(`helm:email_artist:${email}`);
      if (mapped) resolvedArtistId = mapped;
    }

    const sessionToken = encodeSession({
      email,
      artistId: resolvedArtistId || "",
      customerId: customer.customerId,
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

    // Match the existing password/magic redirect logic:
    // paying subscribers (have customerId) always go straight to dashboard.
    let redirect = "/intake";
    if (customer.customerId) {
      redirect = resolvedArtistId ? `/dashboard?artist=${resolvedArtistId}` : "/dashboard";
    } else if (resolvedArtistId) {
      const profile = await kvGet<UserProfile>(`helm:user:${resolvedArtistId}:profile`);
      redirect = profile
        ? `/dashboard?artist=${resolvedArtistId}`
        : `/intake?artist=${resolvedArtistId}`;
    }

    return NextResponse.json({ ok: true, redirect });
  } catch (err) {
    console.error("reset-password/confirm error", err);
    return NextResponse.json(
      { error: "Failed to set password. Please try again." },
      { status: 500 }
    );
  }
}
