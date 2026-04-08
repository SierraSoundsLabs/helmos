import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { kvGet, kvDel } from "@/lib/kv";
import { encodeSession, COOKIE_NAME, TTL } from "@/lib/session";
import type { UserProfile } from "@/lib/tasks";

interface MagicTokenData {
  email: string;
  artistId: string;
  customerId: string;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.redirect(new URL("/?error=invalid", req.url));
  }

  try {
    const key = `magic:${token}`;
    const data = await kvGet<MagicTokenData>(key);

    if (!data) {
      return NextResponse.redirect(new URL("/?error=expired", req.url));
    }

    // Delete immediately — one-time use
    await kvDel(key);

    // Resolve artistId — prefer Stripe metadata, fall back to KV mapping set during intake
    let artistId = data.artistId;
    if (!artistId) {
      const mapped = await kvGet<string>(`helm:email_artist:${data.email.toLowerCase()}`);
      if (mapped) artistId = mapped;
    }

    // Create session
    const sessionToken = encodeSession({
      email: data.email,
      artistId: artistId || "",
      customerId: data.customerId,
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

    // Determine where to send the user:
    // - Paying subscribers (have customerId) → always go to dashboard
    //   (they've already completed intake; don't send back regardless of artistId)
    // - New subscribers with artistId but no profile → intake
    // - No artistId at all → intake root
    let dashboardUrl = "/intake";
    if (data.customerId) {
      // Returning subscriber — skip intake entirely
      dashboardUrl = artistId ? `/dashboard?artist=${artistId}` : "/dashboard";
    } else if (artistId) {
      const profile = await kvGet<UserProfile>(`helm:user:${artistId}:profile`);
      dashboardUrl = profile
        ? `/dashboard?artist=${artistId}`
        : `/intake?artist=${artistId}`;
    }

    return NextResponse.redirect(new URL(dashboardUrl, req.url));
  } catch (err) {
    console.error("magic/verify error", err);
    return NextResponse.redirect(new URL("/?error=server", req.url));
  }
}
