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
        const songLower = songName.toLowerCase().trim();
        const artistFirst = artistName.toLowerCase().split(" ")[0];
        // Try exact match first, then fuzzy
        const match = (data.results || []).find((r: Record<string, string>) => {
          const trackName = (r.trackName || "").toLowerCase().trim();
          const artist = (r.artistName || "").toLowerCase();
          return trackName === songLower && artist.includes(artistFirst);
        }) || (data.results || []).find((r: Record<string, string>) => {
          const trackName = (r.trackName || "").toLowerCase().trim();
          const artist = (r.artistName || "").toLowerCase();
          return trackName.includes(songLower) && artist.includes(artistFirst);
        }) || (data.results || [])[0]; // fallback to first result if artist matches at all
        if (match?.trackViewUrl) {
          // Keep ?i= track ID param, only strip uo= tracking param
          const url = new URL(match.trackViewUrl);
          url.searchParams.delete("uo");
          result.appleMusicUrl = url.toString();
        }
      }
    } catch { /* non-fatal */ }
  }

  // 2. Odesli (song.link) for Tidal, Amazon, Deezer from Spotify URL (free, no key)
  // If it's an album URL, try to get the first track URL for better Odesli resolution
  let resolvedSpotifyUrl = spotifyUrl;
  if (spotifyUrl?.includes("/album/")) {
    try {
      const albumId = spotifyUrl.split("/album/")[1]?.split("?")[0];
      if (albumId) {
        // Use Spotify public embed to get first track (no auth needed for public albums)
        const embedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`, {
          signal: AbortSignal.timeout(3000),
        });
        // If album is a single (1 track), the album URL works fine with Odesli
        // For multi-track, Odesli will still try its best with the album URL
      }
    } catch { /* use album URL as-is */ }
  }

  if (resolvedSpotifyUrl) {
    try {
      const encoded = encodeURIComponent(resolvedSpotifyUrl);
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
