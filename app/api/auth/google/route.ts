import { NextRequest, NextResponse } from "next/server";
import { kvSet } from "@/lib/kv";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://helmos.co";
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  // Generate random nonce for CSRF protection
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Store nonce in KV for 5 minutes
  await kvSet(`helm:oauth_state:${nonce}`, true, 300);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: nonce,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
