import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("spotify_oauth_state")?.value;
  const codeVerifier = cookieStore.get("spotify_code_verifier")?.value;

  if (error || !code) {
    return NextResponse.redirect(new URL("/?spotify=denied", req.url));
  }
  if (!state || state !== savedState) {
    return NextResponse.redirect(new URL("/?spotify=state_mismatch", req.url));
  }
  if (!codeVerifier) {
    return NextResponse.redirect(new URL("/?spotify=missing_verifier", req.url));
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || "https://helmos.co/api/auth/callback";

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?spotify=token_error", req.url));
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokenData;

  // Clear PKCE cookies
  cookieStore.delete("spotify_code_verifier");
  cookieStore.delete("spotify_oauth_state");

  // Store tokens
  cookieStore.set("spotify_access_token", access_token, {
    httpOnly: true, secure: true,
    maxAge: expires_in - 60,
    path: "/",
  });
  if (refresh_token) {
    cookieStore.set("spotify_refresh_token", refresh_token, {
      httpOnly: true, secure: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
  }

  return NextResponse.redirect(new URL("/?spotify=connected", req.url));
}
