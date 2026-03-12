import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  if (!res.ok) {
    cookieStore.delete("spotify_access_token");
    cookieStore.delete("spotify_refresh_token");
    return NextResponse.json({ error: "Refresh failed" }, { status: 401 });
  }

  const data = await res.json();
  cookieStore.set("spotify_access_token", data.access_token, {
    httpOnly: true, secure: true,
    maxAge: data.expires_in - 60,
    path: "/",
  });
  if (data.refresh_token) {
    cookieStore.set("spotify_refresh_token", data.refresh_token, {
      httpOnly: true, secure: true, maxAge: 60 * 60 * 24 * 30, path: "/",
    });
  }

  return NextResponse.json({ ok: true });
}
