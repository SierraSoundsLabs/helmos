// ─────────────────────────────────────────────────────────────────────────────
// Helmos data layer
//   Spotify  → artist identity, discography
//   Last.fm  → bio, genres/tags, top tracks
//   og:description scrape → monthly listeners (no API key needed, 100% accurate)
// ─────────────────────────────────────────────────────────────────────────────

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
  // Core stats (Chartmetric when available)
  monthlyListeners: number;
  monthlyListenersFormatted: string;
  spotifyFollowers: number;
  spotifyFollowersFormatted: string;
  statsSource: 'chartmetric' | 'none';
  // Top tracks (Last.fm)
  topSong: { name: string; playcount: string; albumArt: string; spotifyUrl: string } | null;
  topTracks: { id: string; name: string; playcount: string; albumArt: string; previewUrl: string | null; spotifyUrl: string }[];
  // Discography (Spotify)
  latestRelease: { name: string; albumArt: string; releaseDate: string; totalTracks: number; type: string; spotifyUrl: string } | null;
  monthsAgoLastRelease: number | null;
  allReleases: Release[];
  bigWin: string | null;
  // Legacy compat fields
  followers: number;
  monthlyListenersRaw: number;
  spotifyPopularity: number;
  // Old fields kept for claude.ts compat
  weeklyListeners: number;
  weeklyListenersFormatted: string;
  totalScrobbles: number;
  totalScrobblesFormatted: string;
}

// ─── Spotify auth ─────────────────────────────────────────────────────────────

let spotifyCache: { token: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  if (spotifyCache && Date.now() < spotifyCache.expiresAt) return spotifyCache.token;
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
  spotifyCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return spotifyCache.token;
}

export function extractArtistId(input: string): string | null {
  const uriMatch = input.match(/spotify:artist:([A-Za-z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = input.match(/open\.spotify\.com\/artist\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9]{22}$/.test(input.trim())) return input.trim();
  return null;
}

// ─── Spotify Partner API (requires user OAuth token) ─────────────────────────

const PARTNER_HASH = "79a4a9d7c3a3781d801e62b62ef11c7ee56fce2626772eb26cd20c69f84b3f49";

export async function fetchMonthlyListeners(artistId: string, userToken: string): Promise<{ monthlyListeners: number; followers: number } | null> {
  try {
    const vars = JSON.stringify({ uri: `spotify:artist:${artistId}`, locale: "", includePrerelease: true });
    const exts = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: PARTNER_HASH } });
    const url = `https://api-partner.spotify.com/pathfinder/v1/query?operationName=queryArtistOverview&variables=${encodeURIComponent(vars)}&extensions=${encodeURIComponent(exts)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const stats = data?.data?.artistUnion?.stats;
    if (!stats) return null;

    return {
      monthlyListeners: Number(stats.monthlyListeners) || 0,
      followers: Number(stats.followers) || 0,
    };
  } catch {
    return null;
  }
}

// ─── Monthly listeners via og:description scrape ─────────────────────────────
// Spotify's public artist page embeds monthly listeners in the og:description
// meta tag: "Artist · 100.3M monthly listeners." — no API key needed, always accurate.

function parseListenerString(raw: string): number {
  const s = raw.replace(/,/g, "").trim();
  if (s.endsWith("B")) return Math.round(parseFloat(s) * 1_000_000_000);
  if (s.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith("K")) return Math.round(parseFloat(s) * 1_000);
  return parseInt(s) || 0;
}

interface SpotifyPublicStats {
  monthlyListeners: number;
  spotifyFollowers: number;
}

async function getSpotifyPublicStats(artistId: string): Promise<SpotifyPublicStats | null> {
  try {
    const res = await fetch(`https://open.spotify.com/artist/${artistId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // og:description: "Artist · 100.3M monthly listeners."
    const ogDesc = html.match(/property="og:description" content="([^"]+)"/)?.[1] ?? "";
    const mlMatch = ogDesc.match(/(\d[\d.,]+[KMBkmb]?)\s*monthly listeners/i);
    if (!mlMatch) return null;

    const monthlyListeners = parseListenerString(mlMatch[1]);

    // og:description doesn't include followers — return 0, use Spotify API for followers
    return { monthlyListeners, spotifyFollowers: 0 };
  } catch {
    return null;
  }
}

// ─── Spotify top tracks (replaces Last.fm) ───────────────────────────────────

async function getSpotifyTopTracks(artistId: string, token: string) {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return { tracks: [] };
    const data = await res.json();
    const tracks = (data.tracks || []).slice(0, 5).map((t: {
      id: string; name: string;
      album: { images: { url: string }[] };
      external_urls: { spotify: string };
      preview_url: string | null;
    }) => ({
      id: t.id,
      name: t.name,
      playcount: "—",
      albumArt: t.album?.images?.[0]?.url || "",
      previewUrl: t.preview_url || null,
      spotifyUrl: t.external_urls?.spotify || "",
    }));
    return { tracks };
  } catch {
    return { tracks: [] };
  }
}

// ─── Spotify discography ──────────────────────────────────────────────────────

async function getSpotifyAlbums(artistId: string, token: string): Promise<Release[]> {
  // Spotify Dev Mode caps limit at 20 — paginate to collect all releases
  const allItems: Release[] = [];
  let offset = 0;
  const limit = 10; // Spotify Dev Mode caps at 10 per request
  const maxPages = 10; // cap at 100 releases

  for (let page = 0; page < maxPages; page++) {
    try {
      const url = `https://api.spotify.com/v1/artists/${artistId}/albums?limit=${limit}&offset=${offset}&include_groups=album,single,ep`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") || "2") * 1000;
        await new Promise(r => setTimeout(r, Math.min(retryAfter, 5000)));
        break; // skip remaining pages on rate limit
      }
      if (!res.ok) break;

      const d = await res.json();
      const items = d.items || [];
      allItems.push(...mapReleases(items));

      // Stop if this was the last page
      if (!d.next || items.length < limit) break;
      offset += limit;
    } catch {
      break;
    }
  }

  return allItems;
}

function mapReleases(items: any[]): Release[] {
  return items.map(a => ({
    id: a.id,
    name: a.name,
    type: a.album_type,
    releaseDate: a.release_date,
    totalTracks: a.total_tracks,
    albumArt: a.images?.[0]?.url || "",
    spotifyUrl: a.external_urls?.spotify || "",
  }));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function monthsAgo(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}

function deriveBigWin(releases: Release[], monthlyListeners: number, cmStats: SpotifyPublicStats | null, tracks: { name: string }[]): string | null {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recent = releases.filter(r => r.releaseDate && new Date(r.releaseDate) >= oneYearAgo);

  if (recent.length >= 3) return `Released ${recent.length} projects in the last year — strong output momentum`;
  if (recent.length === 1) return `Dropped "${recent[0].name}" (${recent[0].type}) — new release in market`;
  if (cmStats && monthlyListeners >= 100_000) return `${formatNumber(monthlyListeners)} monthly listeners on Spotify — proven audience`;
  if (cmStats && monthlyListeners >= 10_000) return `${formatNumber(monthlyListeners)} monthly listeners — real active fanbase`;
  if (releases.length > 0) return `Catalog of ${releases.length} releases — ready for royalty audit and sync pitching`;
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchArtistData(artistId: string): Promise<ArtistData> {
  const token = await getSpotifyToken();

  // Spotify: artist identity
  const artistRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!artistRes.ok) {
    if (artistRes.status === 404) throw new Error("Artist not found");
    throw new Error(`Spotify API error: ${artistRes.status}`);
  }
  const artist = await artistRes.json();
  if (!artist?.name) throw new Error("Artist not found");

  // Parallel: Spotify discography + top tracks + public stats scrape
  const [spotifyReleases, spotifyTracks, cmStats] = await Promise.all([
    getSpotifyAlbums(artistId, token),
    getSpotifyTopTracks(artistId, token),
    getSpotifyPublicStats(artistId),
  ]);

  const allReleases = spotifyReleases.sort(
    (a, b) => new Date(b.releaseDate || "").getTime() - new Date(a.releaseDate || "").getTime()
  );
  const latestRelease = allReleases[0] || null;
  // Use Spotify's own genres; fall back to "Independent" if empty
  const genres = (artist.genres as string[] | undefined)?.length
    ? (artist.genres as string[]).slice(0, 5)
    : ["Independent"];
  const topSong = spotifyTracks.tracks[0]
    ? { name: spotifyTracks.tracks[0].name, playcount: "—", albumArt: spotifyTracks.tracks[0].albumArt, spotifyUrl: spotifyTracks.tracks[0].spotifyUrl }
    : null;

  const monthlyListeners = cmStats?.monthlyListeners ?? 0;
  // Followers: use Spotify API value (available in client credentials response)
  const spotifyFollowers = (artist.followers?.total as number | undefined) ?? 0;
  const statsSource: 'chartmetric' | 'none' = cmStats ? 'chartmetric' : 'none';

  const bigWin = deriveBigWin(allReleases, monthlyListeners, cmStats, spotifyTracks.tracks);

  return {
    id: artistId,
    name: artist.name,
    image: artist.images?.[0]?.url || "",
    bio: "",
    genres,
    spotifyUrl: artist.external_urls?.spotify || `https://open.spotify.com/artist/${artistId}`,
    monthlyListeners,
    monthlyListenersFormatted: monthlyListeners > 0 ? formatNumber(monthlyListeners) : "—",
    spotifyFollowers,
    spotifyFollowersFormatted: spotifyFollowers > 0 ? formatNumber(spotifyFollowers) : "—",
    statsSource,
    topSong,
    topTracks: spotifyTracks.tracks,
    latestRelease,
    monthsAgoLastRelease: latestRelease ? monthsAgo(latestRelease.releaseDate) : null,
    allReleases,
    bigWin,
    // Legacy compat
    followers: spotifyFollowers,
    monthlyListenersRaw: monthlyListeners,
    spotifyPopularity: 0,
    weeklyListeners: monthlyListeners,
    weeklyListenersFormatted: monthlyListeners > 0 ? formatNumber(monthlyListeners) : "—",
    totalScrobbles: 0,
    totalScrobblesFormatted: "—",
  };
}
