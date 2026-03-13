import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "3TVXtAsR1Inumwj472S9r4";
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${creds}` },
    body: "grant_type=client_credentials",
  });
  const { access_token: token } = await tokenRes.json();

  // Try different URL encodings
  const url1 = `https://api.spotify.com/v1/artists/${id}/albums?limit=50&include_groups=album,single,ep`;
  const url2 = `https://api.spotify.com/v1/artists/${id}/albums?limit=50&include_groups=album%2Csingle%2Cep`;
  const url3 = `https://api.spotify.com/v1/artists/${id}/albums?limit=10`;

  const [r1, r2, r3] = await Promise.all([
    fetch(url1, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(url2, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(url3, { headers: { Authorization: `Bearer ${token}` } }),
  ]);

  const [b1, b2, b3] = await Promise.all([r1.text(), r2.text(), r3.text()]);

  return NextResponse.json({
    url1: { status: r1.status, body: b1.slice(0, 200) },
    url2: { status: r2.status, body: b2.slice(0, 200) },
    url3: { status: r3.status, body: b3.slice(0, 200) },
  });
}
