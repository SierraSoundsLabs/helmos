const LASTFM_KEY = "b25b959554ed76058ac220b7b2e0a026";

export interface Release {
  id: string;
  name: string;
  type: string;
  releaseDate: string;
  totalTracks: number;
  albumArt: string;
  spotifyUrl: string;
}

export interface ArtistData {
  id: string;
  name: string;
  image: string;
  bio: string;
  genres: string[];
  spotifyUrl: string;
  // Listener stats (Last.fm)
  weeklyListeners: number;
  weeklyListenersFormatted: string;
  totalScrobbles: number;
  totalScrobblesFormatted: string;
  // Top tracks (Last.fm)
  topSong: { name: string; playcount: string; albumArt: string; spotifyUrl: string } | null;
  topTracks: { id: string; name: string; playcount: string; albumArt: string; previewUrl: string | null; spotifyUrl: string }[];
  // Discography (Spotify)
  latestRelease: { name: string; albumArt: string; releaseDate: string; totalTracks: number; type: string; spotifyUrl: string } | null;
  monthsAgoLastRelease: number | null;
  allReleases: Release[];
  bigWin: string | null;
  // Legacy compat (used in claude.ts)
  followers: number;
  monthlyListeners: string;
  monthlyListenersRaw: number;
  spotifyPopularity: number;
  spotifyFollowers: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing Spotify credentials");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token error: ${res.status}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

export function extractArtistId(input: string): string | null {
  const uriMatch = input.match(/spotify:artist:([A-Za-z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = input.match(/open\.spotify\.com\/artist\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9]{22}$/.test(input.trim())) return input.trim();
  return null;
}

function monthsAgo(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").replace(/\. Read more.*$/i, "").trim();
}

// ── Last.fm ─────────────────────────────────────────────────────────────────
async function lastfmGet(params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, api_key: LASTFM_KEY, format: "json" });
  const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${q}`);
  if (!res.ok) return null;
  return res.json();
}

async function getLastFmArtist(name: string) {
  try {
    const [info, topTracks, topAlbums] = await Promise.all([
      lastfmGet({ method: "artist.getinfo", artist: name }),
      lastfmGet({ method: "artist.gettoptracks", artist: name, limit: "5" }),
      lastfmGet({ method: "artist.gettopalbums", artist: name, limit: "10" }),
    ]);

    const artist = info?.artist;
    const rawBio = artist?.bio?.summary || artist?.bio?.content || "";
    const bio = stripHtml(rawBio).slice(0, 600);
    const listeners = parseInt(artist?.stats?.listeners || "0");
    const playcount = parseInt(artist?.stats?.playcount || "0");
    const tags = (artist?.tags?.tag || []).slice(0, 5).map((t: { name: string }) => t.name);

    const tracks = (topTracks?.toptracks?.track || []).slice(0, 5).map((t: {
      name: string; playcount: string;
      image?: { "#text": string }[];
      url?: string;
    }) => ({
      id: t.name,
      name: t.name,
      playcount: parseInt(t.playcount || "0") > 0
        ? parseInt(t.playcount).toLocaleString()
        : "—",
      albumArt: t.image?.[2]?.["#text"] || "",
      previewUrl: null,
      spotifyUrl: t.url || "",
    }));

    const albums = (topAlbums?.topalbums?.album || []).map((a: {
      name: string; playcount: number;
      image?: { "#text": string }[];
      url?: string;
    }) => ({
      id: a.name,
      name: a.name,
      type: "album",
      releaseDate: "",
      totalTracks: 0,
      albumArt: a.image?.[2]?.["#text"] || "",
      spotifyUrl: a.url || "",
    }));

    return { bio, listeners, playcount, tags, tracks, albums };
  } catch {
    return { bio: "", listeners: 0, playcount: 0, tags: [], tracks: [], albums: [] };
  }
}

// ── Spotify discography (with retry on 429) ─────────────────────────────────
async function getSpotifyAlbums(artistId: string, token: string): Promise<Release[]> {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single,ep`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 429) {
      // Rate limited — try once more after delay
      const retryAfter = parseInt(res.headers.get("retry-after") || "2");
      await new Promise(r => setTimeout(r, Math.min(retryAfter * 1000, 5000)));
      const res2 = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single,ep`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res2.ok) return [];
      const d = await res2.json();
      return d.items || [];
    }
    if (!res.ok) return [];
    const d = await res.json();
    return (d.items || []).map((a: {
      id: string; name: string; album_type: string; release_date: string;
      total_tracks: number; images?: { url: string }[]; external_urls?: { spotify: string };
    }) => ({
      id: a.id,
      name: a.name,
      type: a.album_type,
      releaseDate: a.release_date,
      totalTracks: a.total_tracks,
      albumArt: a.images?.[0]?.url || "",
      spotifyUrl: a.external_urls?.spotify || "",
    }));
  } catch {
    return [];
  }
}

function deriveBigWin(releases: Release[], listeners: number, playcount: number, tracks: { name: string }[]): string | null {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recent = releases.filter(r => r.releaseDate && new Date(r.releaseDate) >= oneYearAgo);

  if (recent.length >= 3) return `Released ${recent.length} projects in the last year — strong output momentum`;
  if (recent.length === 1) {
    const r = recent[0];
    return `Dropped "${r.name}" (${r.type}) — new release in market`;
  }
  if (playcount >= 1_000_000) return `${formatNumber(playcount)} Last.fm scrobbles — proven listener engagement`;
  if (listeners >= 10_000) return `${formatNumber(listeners)} weekly listeners on Last.fm — real active audience`;
  if (tracks.length > 0) return `Catalog indexed across ${releases.length} releases — ready for royalty audit and sync pitching`;
  return null;
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function fetchArtistData(artistId: string): Promise<ArtistData> {
  const token = await getSpotifyToken();

  // Spotify: just the artist object (name, image, URI — that's all they return now)
  const artistRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!artistRes.ok) {
    if (artistRes.status === 404) throw new Error("Artist not found");
    throw new Error(`Spotify API error: ${artistRes.status}`);
  }
  const artist = await artistRes.json();
  if (!artist?.name) throw new Error("Artist not found");

  // Parallel: Spotify albums + Last.fm (all stats)
  const [spotifyReleases, lastfm] = await Promise.all([
    getSpotifyAlbums(artistId, token),
    getLastFmArtist(artist.name),
  ]);

  // Sort releases newest first
  const allReleases = spotifyReleases.sort(
    (a, b) => new Date(b.releaseDate || "").getTime() - new Date(a.releaseDate || "").getTime()
  );
  const latestRelease = allReleases[0] || null;

  // Merge genres: Last.fm tags (Spotify no longer returns genres in dev mode)
  const genres = lastfm.tags.length > 0 ? lastfm.tags : ["Independent"];

  // Top song from Last.fm
  const topSong = lastfm.tracks[0]
    ? { name: lastfm.tracks[0].name, playcount: lastfm.tracks[0].playcount, albumArt: lastfm.tracks[0].albumArt, spotifyUrl: lastfm.tracks[0].spotifyUrl }
    : null;

  const bigWin = deriveBigWin(allReleases, lastfm.listeners, lastfm.playcount, lastfm.tracks);

  return {
    id: artistId,
    name: artist.name,
    image: artist.images?.[0]?.url || "",
    bio: lastfm.bio,
    genres,
    spotifyUrl: artist.external_urls?.spotify || `https://open.spotify.com/artist/${artistId}`,
    weeklyListeners: lastfm.listeners,
    weeklyListenersFormatted: lastfm.listeners > 0 ? formatNumber(lastfm.listeners) : "—",
    totalScrobbles: lastfm.playcount,
    totalScrobblesFormatted: lastfm.playcount > 0 ? formatNumber(lastfm.playcount) : "—",
    topSong,
    topTracks: lastfm.tracks,
    latestRelease,
    monthsAgoLastRelease: latestRelease ? monthsAgo(latestRelease.releaseDate) : null,
    allReleases,
    bigWin,
    // Compat fields for claude.ts
    followers: lastfm.listeners,
    monthlyListeners: lastfm.listeners > 0 ? formatNumber(lastfm.listeners) : "—",
    monthlyListenersRaw: lastfm.listeners,
    spotifyPopularity: 0,
    spotifyFollowers: 0,
  };
}
