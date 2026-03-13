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
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  // Trace EXACT same path as getSpotifyAlbums
  const albumsUrl = `https://api.spotify.com/v1/artists/${id}/albums?limit=50&include_groups=album,single,ep`;
  const res = await fetch(albumsUrl, { headers: { Authorization: `Bearer ${token}` } });
  const status = res.status;
  const ok = res.ok;
  
  let items: unknown[] = [];
  let parseError = "";
  try {
    const d = await res.json();
    items = d.items || [];
  } catch(e) { parseError = String(e); }

  // Also test mapReleases logic
  const mapped = items.map((a: any) => ({
    id: a.id,
    name: a.name,
    type: a.album_type,
    releaseDate: a.release_date,
    totalTracks: a.total_tracks,
    albumArt: a.images?.[0]?.url || "",
    spotifyUrl: a.external_urls?.spotify || "",
  }));

  return NextResponse.json({
    status, ok, itemsCount: items.length, mappedCount: mapped.length,
    parseError,
    first: mapped[0] || null,
  });
}
