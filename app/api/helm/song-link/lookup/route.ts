import { NextRequest, NextResponse } from "next/server";

// Lookup platform links for a song using free APIs (no keys required)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const spotifyUrl = searchParams.get("spotifyUrl");
  const artistName = searchParams.get("artistName") || "";
  const songName = searchParams.get("songName") || "";

  const result: {
    appleMusicUrl?: string;
    tidalUrl?: string;
    amazonUrl?: string;
    deezerUrl?: string;
    youtubeSearchUrl?: string;
  } = {};

  // 1. iTunes Search for Apple Music URL (free, no key)
  if (artistName && songName) {
    try {
      const query = encodeURIComponent(`${songName} ${artistName}`);
      const res = await fetch(
        `https://itunes.apple.com/search?term=${query}&entity=song&limit=5`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        const match = (data.results || []).find((r: Record<string, string>) => {
          const trackName = (r.trackName || "").toLowerCase();
          const artist = (r.artistName || "").toLowerCase();
          return (
            trackName.includes(songName.toLowerCase()) &&
            artist.includes(artistName.toLowerCase().split(" ")[0])
          );
        });
        if (match?.trackViewUrl) {
          // Clean up the uo=4 tracking param
          result.appleMusicUrl = match.trackViewUrl.replace(/\?.*$/, "");
        }
      }
    } catch { /* non-fatal */ }
  }

  // 2. Odesli (song.link) for Tidal, Amazon, Deezer from Spotify URL (free, no key)
  if (spotifyUrl) {
    try {
      const encoded = encodeURIComponent(spotifyUrl);
      const res = await fetch(
        `https://api.song.link/v1-alpha.1/links?url=${encoded}&userCountry=US`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        const links = data.linksByPlatform || {};
        if (links.tidal?.url) result.tidalUrl = links.tidal.url;
        if (links.amazonMusic?.url) result.amazonUrl = links.amazonMusic.url;
        if (links.deezer?.url) result.deezerUrl = links.deezer.url;
        // Odesli sometimes returns Apple Music too
        if (!result.appleMusicUrl && links.appleMusic?.url) {
          result.appleMusicUrl = links.appleMusic.url;
        }
      }
    } catch { /* non-fatal */ }
  }

  // 3. YouTube search URL (no API needed — just a direct search link)
  if (artistName && songName) {
    const ytQuery = encodeURIComponent(`${artistName} ${songName} official`);
    result.youtubeSearchUrl = `https://www.youtube.com/results?search_query=${ytQuery}`;
  }

  return NextResponse.json(result);
}
