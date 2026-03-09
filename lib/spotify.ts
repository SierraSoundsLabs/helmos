export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string; width: number; height: number }[];
  genres: string[];
  followers: { total: number };
  popularity: number;
  external_urls: { spotify: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  popularity: number;
  preview_url: string | null;
  album: {
    id: string;
    name: string;
    images: { url: string }[];
    release_date: string;
    total_tracks: number;
  };
  external_urls: { spotify: string };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  total_tracks: number;
  images: { url: string }[];
  external_urls: { spotify: string };
}

export interface ArtistData {
  id: string;
  name: string;
  image: string;
  followers: number;
  genres: string[];
  popularity: number;
  spotifyUrl: string;
  topTracks: {
    id: string;
    name: string;
    popularity: number;
    albumArt: string;
    previewUrl: string | null;
    spotifyUrl: string;
    streamEstimate: string;
  }[];
  latestRelease: {
    name: string;
    albumArt: string;
    releaseDate: string;
    totalTracks: number;
    type: string;
    spotifyUrl: string;
  } | null;
  monthsAgoLastRelease: number | null;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Spotify credentials");
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify token error: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export function extractArtistId(input: string): string | null {
  // Handle spotify:artist:ID format
  const uriMatch = input.match(/spotify:artist:([A-Za-z0-9]+)/);
  if (uriMatch) return uriMatch[1];

  // Handle https://open.spotify.com/artist/ID format
  const urlMatch = input.match(/open\.spotify\.com\/artist\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];

  // Handle bare artist ID (22 chars alphanumeric)
  if (/^[A-Za-z0-9]{22}$/.test(input.trim())) return input.trim();

  return null;
}

function estimateStreams(popularity: number): string {
  // Rough heuristic based on Spotify popularity score
  if (popularity >= 80) return "50M+";
  if (popularity >= 70) return "10M–50M";
  if (popularity >= 60) return "1M–10M";
  if (popularity >= 50) return "500K–1M";
  if (popularity >= 40) return "100K–500K";
  if (popularity >= 30) return "10K–100K";
  if (popularity >= 20) return "1K–10K";
  return "<1K";
}

function monthsAgo(dateStr: string): number {
  const releaseDate = new Date(dateStr);
  const now = new Date();
  const months =
    (now.getFullYear() - releaseDate.getFullYear()) * 12 +
    (now.getMonth() - releaseDate.getMonth());
  return Math.max(0, months);
}

export async function fetchArtistData(artistId: string): Promise<ArtistData> {
  const token = await getAccessToken();

  const headers = { Authorization: `Bearer ${token}` };

  const [artistRes, topTracksRes, albumsRes] = await Promise.all([
    fetch(`https://api.spotify.com/v1/artists/${artistId}`, { headers }),
    fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, { headers }),
    fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?limit=10&include_groups=album,single`, { headers }),
  ]);

  if (!artistRes.ok) {
    if (artistRes.status === 404) throw new Error("Artist not found");
    throw new Error(`Spotify API error: ${artistRes.status}`);
  }

  const [artist, topTracksData, albumsData] = await Promise.all([
    artistRes.json() as Promise<SpotifyArtist>,
    topTracksRes.json() as Promise<{ tracks: SpotifyTrack[] }>,
    albumsRes.json() as Promise<{ items: SpotifyAlbum[] }>,
  ]);

  const topTracks = (topTracksData.tracks || []).slice(0, 5).map((t) => ({
    id: t.id,
    name: t.name,
    popularity: t.popularity,
    albumArt: t.album.images[0]?.url || "",
    previewUrl: t.preview_url,
    spotifyUrl: t.external_urls.spotify,
    streamEstimate: estimateStreams(t.popularity),
  }));

  const albums = albumsData.items || [];
  const latestAlbum = albums[0] || null;

  return {
    id: artist.id,
    name: artist.name,
    image: artist.images[0]?.url || "",
    followers: artist.followers.total,
    genres: artist.genres,
    popularity: artist.popularity,
    spotifyUrl: artist.external_urls.spotify,
    topTracks,
    latestRelease: latestAlbum
      ? {
          name: latestAlbum.name,
          albumArt: latestAlbum.images[0]?.url || "",
          releaseDate: latestAlbum.release_date,
          totalTracks: latestAlbum.total_tracks,
          type: latestAlbum.album_type,
          spotifyUrl: latestAlbum.external_urls.spotify,
        }
      : null,
    monthsAgoLastRelease: latestAlbum ? monthsAgo(latestAlbum.release_date) : null,
  };
}
