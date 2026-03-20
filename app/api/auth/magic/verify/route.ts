import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { kvGet, kvDel } from "@/lib/kv";
import { encodeSession, COOKIE_NAME, TTL } from "@/lib/session";

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

    // Create session
    const sessionToken = encodeSession({
      email: data.email,
      artistId: data.artistId,
      customerId: data.customerId,
      plan: "heatseeker",
    });

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: true,
      maxAge: TTL,
      path: "/",
      sameSite: "lax",
    });

    const dashboardUrl = data.artistId
      ? `/dashboard?artist=${data.artistId}`
      : "/intake";

    return NextResponse.redirect(new URL(dashboardUrl, req.url));
  } catch (err) {
    console.error("magic/verify error", err);
    return NextResponse.redirect(new URL("/?error=server", req.url));
  }
}
