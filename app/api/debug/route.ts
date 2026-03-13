import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "3TVXtAsR1Inumwj472S9r4";
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const { access_token: token } = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${creds}` },
    body: "grant_type=client_credentials",
  }).then(r => r.json());

  // Test limit=20
  const r20 = await fetch(`https://api.spotify.com/v1/artists/${id}/albums?limit=20&offset=0&include_groups=album,single,ep`, { headers: { Authorization: `Bearer ${token}` } });
  const b20 = await r20.text();
  
  return NextResponse.json({ status20: r20.status, body20: b20.slice(0, 300) });
}
