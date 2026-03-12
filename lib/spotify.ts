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
  followers: number;          // Last.fm listeners (for Claude prompt)
  monthlyListeners: string;   // Real Spotify monthly listeners, scraped
  monthlyListenersRaw: number; // Raw number for logic
  genres: string[];
  spotifyPopularity: number;  // from Spotify direct artist endpoint
  spotifyFollowers: number;   // from Spotify
  topSong: { name: string; popularity: number; streamEstimate: string; albumArt: string; spotifyUrl: string } | null;
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
  allReleases: Release[];
  bigWin: string | null;      // notable achievement from last year
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

function estimateStreams(popularity: number): string {
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
  const d = new Date(dateStr);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").replace(/\. Read more.*$/i, "").trim();
}

// Scrape real Spotify monthly listeners from the public artist page
async function scrapeSpotifyMonthlyListeners(artistId: string): Promise<number | null> {
  try {
    const res = await fetch(`https://open.spotify.com/artist/${artistId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 3600 }, // cache 1hr
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Pattern 1: JSON in page data
    const m1 = html.match(/"monthlyListeners"\s*:\s*(\d+)/);
    if (m1) return parseInt(m1[1]);
    // Pattern 2: visible text on page "X monthly listeners"
    const m2 = html.match(/([\d,]+)\s+monthly listener/i);
    if (m2) return parseInt(m2[1].replace(/,/g, ""));
    return null;
  } catch {
    return null;
  }
}

async function getLastFmData(artistName: string): Promise<{ listeners: number; playcount: number; tags: string[]; bio: string }> {
  const LASTFM_KEY = "b25b959554ed76058ac220b7b2e0a026";
  try {
    const url = `http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_KEY}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return { listeners: 0, playcount: 0, tags: [], bio: "" };
    const data = await res.json();
    const artist = data.artist;
    if (!artist) return { listeners: 0, playcount: 0, tags: [], bio: "" };
    const rawBio = artist.bio?.summary || artist.bio?.content || "";
    const bio = stripHtml(rawBio).slice(0, 600);
    return {
      listeners: parseInt(artist.stats?.listeners || "0"),
      playcount: parseInt(artist.stats?.playcount || "0"),
      tags: (artist.tags?.tag || []).slice(0, 5).map((t: { name: string }) => t.name),
      bio,
    };
  } catch {
    return { listeners: 0, playcount: 0, tags: [], bio: "" };
  }
}

// Derive a "big win" from the past year's releases
function deriveBigWin(releases: Release[], spotifyFollowers: number, monthlyListenersRaw: number): string | null {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const recentReleases = releases.filter(r => new Date(r.releaseDate) >= oneYearAgo);

  if (recentReleases.length >= 3) {
    return `Released ${recentReleases.length} projects in the last year — strong output momentum`;
  }
  if (recentReleases.length > 0) {
    const latest = recentReleases[0];
    return `Dropped "${latest.name}" ${latest.type === "album" ? "(album)" : latest.type === "ep" ? "(EP)" : "(single)"} — new release in market`;
  }
  if (monthlyListenersRaw >= 100_000) {
    return `${formatNumber(monthlyListenersRaw)} Spotify monthly listeners — real audience built`;
  }
  if (spotifyFollowers >= 10_000) {
    return `${formatNumber(spotifyFollowers)} Spotify followers — meaningful fanbase to build from`;
  }
  return null;
}

export async function fetchArtistData(artistId: string): Promise<ArtistData> {
  const token = await getSpotifyToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch artist directly — direct endpoint still returns popularity, genres, followers
  const artistRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, { headers });
  if (!artistRes.ok) {
    if (artistRes.status === 404) throw new Error("Artist not found");
    throw new Error(`Spotify API error: ${artistRes.status}`);
  }
  const artist = await artistRes.json();

  // Parallel: top tracks, discography, monthly listeners scrape, Last.fm
  const [topTracksRes, albumsRes, monthlyListenersRaw] = await Promise.all([
    fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, { headers })
      .then(r => r.ok ? r.json() : { tracks: [] })
      .catch(() => ({ tracks: [] })),
    fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single,ep&market=US`, { headers })
      .then(r => r.ok ? r.json() : { items: [] })
      .catch(() => ({ items: [] })),
    scrapeSpotifyMonthlyListeners(artistId),
  ]);

  const lastfm = await getLastFmData(artist.name);

  // Spotify direct endpoint: use real popularity + genres + followers
  const spotifyPopularity: number = typeof artist.popularity === "number" ? artist.popularity : 0;
  const spotifyFollowers: number = artist.followers?.total || 0;
  const spotifyGenres: string[] = artist.genres?.length > 0 ? artist.genres : [];

  // Merge genres: Spotify first, fall back to Last.fm tags
  const genres = spotifyGenres.length > 0 ? spotifyGenres.slice(0, 4) : (lastfm.tags.length > 0 ? lastfm.tags : ["Independent"]);

  const topTracksData = topTracksRes as { tracks: any[] };
  const albumsData = albumsRes as { items: any[] };

  const topTracks = (topTracksData.tracks || []).slice(0, 5).map((t: any) => ({
    id: t.id,
    name: t.name,
    popularity: t.popularity || 0,
    albumArt: t.album?.images?.[0]?.url || "",
    previewUrl: t.preview_url,
    spotifyUrl: t.external_urls?.spotify || "",
    streamEstimate: estimateStreams(t.popularity || 0),
  }));

  const albums = (albumsData.items || []).sort(
    (a: any, b: any) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
  );
  const latestAlbum = albums[0] || null;

  const bestTrack = (topTracksData.tracks || []).sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))[0] || null;

  const allReleases: Release[] = albums.map((a: any) => ({
    id: a.id,
    name: a.name,
    type: a.album_type,
    releaseDate: a.release_date,
    totalTracks: a.total_tracks,
    albumArt: a.images?.[0]?.url || "",
    spotifyUrl: a.external_urls?.spotify || "",
  }));

  // Monthly listeners: prefer real Spotify scrape, fall back to Last.fm
  const listenersRaw = monthlyListenersRaw ?? lastfm.listeners;
  const bigWin = deriveBigWin(allReleases, spotifyFollowers, listenersRaw);

  return {
    id: artist.id,
    name: artist.name,
    image: artist.images?.[0]?.url || "",
    bio: lastfm.bio,
    followers: lastfm.listeners,
    monthlyListeners: listenersRaw > 0 ? formatNumber(listenersRaw) : "—",
    monthlyListenersRaw: listenersRaw,
    genres,
    spotifyPopularity,
    spotifyFollowers,
    topSong: bestTrack ? {
      name: bestTrack.name,
      popularity: bestTrack.popularity || 0,
      streamEstimate: estimateStreams(bestTrack.popularity || 0),
      albumArt: bestTrack.album?.images?.[0]?.url || "",
      spotifyUrl: bestTrack.external_urls?.spotify || "",
    } : null,
    spotifyUrl: artist.external_urls?.spotify || `https://open.spotify.com/artist/${artist.id}`,
    topTracks,
    latestRelease: latestAlbum ? {
      name: latestAlbum.name,
      albumArt: latestAlbum.images?.[0]?.url || "",
      releaseDate: latestAlbum.release_date,
      totalTracks: latestAlbum.total_tracks,
      type: latestAlbum.album_type,
      spotifyUrl: latestAlbum.external_urls?.spotify || "",
    } : null,
    monthsAgoLastRelease: latestAlbum ? monthsAgo(latestAlbum.release_date) : null,
    allReleases,
    bigWin,
  };
}
