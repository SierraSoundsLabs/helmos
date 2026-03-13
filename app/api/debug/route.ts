import { NextResponse, NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "3TVXtAsR1Inumwj472S9r4";
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Basic ${creds}` },
    body: "grant_type=client_credentials",
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  // Test albums endpoint
  const albumsRes = await fetch(
    `https://api.spotify.com/v1/artists/${id}/albums?limit=5&include_groups=album,single,ep`,
    { headers: { "Authorization": `Bearer ${token}` } }
  );
  const albumsData = await albumsRes.json();

  return NextResponse.json({
    albumsStatus: albumsRes.status,
    albumsError: albumsData.error || null,
    albumsCount: albumsData.items?.length ?? 0,
    firstAlbum: albumsData.items?.[0]?.name || null,
    rawAlbumsKeys: albumsData.items ? Object.keys(albumsData.items[0] || {}) : [],
  });
}
