import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || "https://helmos.co/api/auth/callback";

  // PKCE
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(16));

  const cookieStore = await cookies();
  cookieStore.set("spotify_code_verifier", codeVerifier, { httpOnly: true, secure: true, maxAge: 600, path: "/" });
  cookieStore.set("spotify_oauth_state", state, { httpOnly: true, secure: true, maxAge: 600, path: "/" });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "user-read-private",
    redirect_uri: redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
