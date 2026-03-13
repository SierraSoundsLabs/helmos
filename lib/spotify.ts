// ─────────────────────────────────────────────────────────────────────────────
// Helmos data layer
//   Spotify  → artist identity, discography
//   Last.fm  → bio, genres/tags, top tracks
//   Chartmetric → monthly listeners, Spotify followers (the real stats)
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

// ─── Chartmetric auth + stats ─────────────────────────────────────────────────

let cmCache: { token: string; expiresAt: number } | null = null;

async function getChartmetricToken(): Promise<string | null> {
  const refreshToken = process.env.CHARTMETRIC_REFRESH_TOKEN;
  if (!refreshToken) return null;
  if (cmCache && Date.now() < cmCache.expiresAt) return cmCache.token;
  try {
    const res = await fetch("https://api.chartmetric.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshtoken: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.token) return null;
    cmCache = { token: data.token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return cmCache.token;
  } catch {
    return null;
  }
}

async function cmGet(path: string, token: string) {
  const res = await fetch(`https://api.chartmetric.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.obj ?? data;
}

interface ChartmetricStats {
  monthlyListeners: number;
  spotifyFollowers: number;
}

async function getChartmetricStats(spotifyArtistId: string): Promise<ChartmetricStats | null> {
  const token = await getChartmetricToken();
  if (!token) return null;

  try {
    // Step 1: Resolve Spotify ID → Chartmetric ID
    const ids = await cmGet(`/api/artist/spotify/${spotifyArtistId}/get-ids`, token);
    if (!ids || ids.length === 0) return null;
    const cmId = ids[0].cm_artist;
    if (!cmId) return null;

    // Step 2: Fetch listeners + followers in parallel
    const [listenersData, followersData] = await Promise.all([
      cmGet(`/api/artist/${cmId}/stat/spotify?field=listeners&latest=true`, token),
      cmGet(`/api/artist/${cmId}/stat/spotify?field=followers&latest=true`, token),
    ]);

    // listeners data is an array — take the last value
    const listenersArr = listenersData?.listeners ?? [];
    const followersArr = followersData?.followers ?? [];

    const latestListeners = listenersArr.length > 0 ? listenersArr[listenersArr.length - 1]?.value ?? 0 : 0;
    const latestFollowers = followersArr.length > 0 ? followersArr[followersArr.length - 1]?.value ?? 0 : 0;

    return {
      monthlyListeners: Number(latestListeners) || 0,
      spotifyFollowers: Number(latestFollowers) || 0,
    };
  } catch {
    return null;
  }
}

// ─── Last.fm (bio, tags, top tracks only) ────────────────────────────────────

const LASTFM_KEY = process.env.LASTFM_API_KEY || "b25b959554ed76058ac220b7b2e0a026";

async function lastfmGet(params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, api_key: LASTFM_KEY, format: "json" });
  const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${q}`);
  if (!res.ok) return null;
  return res.json();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").replace(/\. Read more.*$/i, "").trim();
}

async function getLastFmArtist(name: string) {
  try {
    const [info, topTracks] = await Promise.all([
      lastfmGet({ method: "artist.getinfo", artist: name }),
      lastfmGet({ method: "artist.gettoptracks", artist: name, limit: "5" }),
    ]);

    const artist = info?.artist;
    const rawBio = artist?.bio?.summary || artist?.bio?.content || "";
    const bio = stripHtml(rawBio).slice(0, 600);
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

    return { bio, tags, tracks };
  } catch {
    return { bio: "", tags: [], tracks: [] };
  }
}

// ─── Spotify discography ──────────────────────────────────────────────────────

async function getSpotifyAlbums(artistId: string, token: string): Promise<Release[]> {
  // Spotify Dev Mode caps limit at 20 — paginate to collect all releases
  const allItems: Release[] = [];
  let offset = 0;
  const limit = 20;
  const maxPages = 5; // cap at 100 releases

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

function deriveBigWin(releases: Release[], monthlyListeners: number, cmStats: ChartmetricStats | null, tracks: { name: string }[]): string | null {
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

  // Parallel: Spotify discography + Last.fm (bio/tags/tracks) + Chartmetric (stats)
  const [spotifyReleases, lastfm, cmStats] = await Promise.all([
    getSpotifyAlbums(artistId, token),
    getLastFmArtist(artist.name),
    getChartmetricStats(artistId),
  ]);

  const allReleases = spotifyReleases.sort(
    (a, b) => new Date(b.releaseDate || "").getTime() - new Date(a.releaseDate || "").getTime()
  );
  const latestRelease = allReleases[0] || null;
  const genres = lastfm.tags.length > 0 ? lastfm.tags : ["Independent"];
  const topSong = lastfm.tracks[0]
    ? { name: lastfm.tracks[0].name, playcount: lastfm.tracks[0].playcount, albumArt: lastfm.tracks[0].albumArt, spotifyUrl: lastfm.tracks[0].spotifyUrl }
    : null;

  const monthlyListeners = cmStats?.monthlyListeners ?? 0;
  const spotifyFollowers = cmStats?.spotifyFollowers ?? 0;
  const statsSource: 'chartmetric' | 'none' = cmStats ? 'chartmetric' : 'none';

  const bigWin = deriveBigWin(allReleases, monthlyListeners, cmStats, lastfm.tracks);

  return {
    id: artistId,
    name: artist.name,
    image: artist.images?.[0]?.url || "",
    bio: lastfm.bio,
    genres,
    spotifyUrl: artist.external_urls?.spotify || `https://open.spotify.com/artist/${artistId}`,
    monthlyListeners,
    monthlyListenersFormatted: monthlyListeners > 0 ? formatNumber(monthlyListeners) : "—",
    spotifyFollowers,
    spotifyFollowersFormatted: spotifyFollowers > 0 ? formatNumber(spotifyFollowers) : "—",
    statsSource,
    topSong,
    topTracks: lastfm.tracks,
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
