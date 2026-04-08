import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { kvGet, kvDel } from "@/lib/kv";
import { encodeSession, COOKIE_NAME, TTL } from "@/lib/session";
import { findStripeCustomer } from "@/lib/stripe";
import type { UserProfile } from "@/lib/tasks";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  error?: string;
}

interface GoogleUserInfo {
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  sub: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://helmos.co";

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/?error=oauth_denied`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL(`/?error=invalid`, req.url));
  }

  // Verify state against KV
  const stateKey = `helm:oauth_state:${state}`;
  const validState = await kvGet<boolean>(stateKey);
  if (!validState) {
    return NextResponse.redirect(new URL(`/?error=invalid`, req.url));
  }
  await kvDel(stateKey);

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokens = (await tokenRes.json()) as GoogleTokenResponse;
    if (tokens.error || !tokens.access_token) {
      console.error("Google token exchange error:", tokens);
      return NextResponse.redirect(new URL(`/?error=oauth_failed`, req.url));
    }

    // Get user info
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );
    const userInfo = (await userInfoRes.json()) as GoogleUserInfo;

    if (!userInfo.email) {
      return NextResponse.redirect(new URL(`/?error=oauth_failed`, req.url));
    }

    const email = userInfo.email.toLowerCase();

    // Find Stripe customer — must have active subscription
    const customer = await findStripeCustomer(email);
    if (!customer) {
      return NextResponse.redirect(
        new URL(`/?error=no_subscription`, req.url)
      );
    }

    // Resolve artistId from KV if needed
    let artistId = customer.artistId;
    if (!artistId) {
      const mapped = await kvGet<string>(
        `helm:email_artist:${email}`
      );
      if (mapped) artistId = mapped;
    }

    // Create session
    const sessionToken = encodeSession({
      email,
      artistId: artistId || "",
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

    // Redirect to dashboard or intake
    // Paying subscribers (have customerId) always go straight to dashboard —
    // they've already completed intake. Only new/free users need intake.
    let dashboardUrl = "/intake";
    if (artistId) {
      if (customer.customerId) {
        dashboardUrl = `/dashboard?artist=${artistId}`;
      } else {
        const profile = await kvGet<UserProfile>(
          `helm:user:${artistId}:profile`
        );
        dashboardUrl = profile
          ? `/dashboard?artist=${artistId}`
          : `/intake?artist=${artistId}`;
      }
    }

    return NextResponse.redirect(new URL(dashboardUrl, req.url));
  } catch (err) {
    console.error("google/callback error", err);
    return NextResponse.redirect(new URL(`/?error=server`, req.url));
  }
}
