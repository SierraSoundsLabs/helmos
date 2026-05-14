import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";
import type { ArtistData } from "@/lib/spotify";
import type { OneSheetData, UpcomingShow } from "@/lib/types";
import { artistSlug } from "@/lib/types";
import type { EPKData } from "@/app/api/helm/epk/route";
import { artistEmail } from "@/lib/email";

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^(?:Short|Medium|Long)\s+Bio[^\n]*\n?/gim, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^[-–—]\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Try to derive an Apple Music artist URL from a Spotify artist URL.
// 1. Odesli (song.link) — direct platform map, most reliable
// 2. iTunes Search by artist name — fuzzy fallback
async function deriveAppleMusicArtistUrl(
  spotifyArtistUrl: string | undefined,
  artistName: string
): Promise<string | null> {
  if (spotifyArtistUrl) {
    try {
      const encoded = encodeURIComponent(spotifyArtistUrl);
      const res = await fetch(
        `https://api.song.link/v1-alpha.1/links?url=${encoded}&userCountry=US`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (res.ok) {
        const data = await res.json();
        const am = data.linksByPlatform?.appleMusic?.url;
        if (am) return am as string;
      }
    } catch { /* fall through to iTunes */ }
  }
  if (artistName) {
    try {
      const q = encodeURIComponent(artistName);
      const res = await fetch(
        `https://itunes.apple.com/search?term=${q}&entity=musicArtist&limit=5`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        const target = artistName.toLowerCase().trim();
        const match = (data.results || []).find(
          (r: Record<string, string>) =>
            (r.artistName || "").toLowerCase().trim() === target
        );
        if (match?.artistLinkUrl) return match.artistLinkUrl as string;
      }
    } catch { /* non-fatal */ }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { artistData: ArtistData; bio: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { artistData, bio } = body;
  if (!artistData?.name) {
    return NextResponse.json({ error: "Missing artistData.name" }, { status: 400 });
  }

  const slug = artistSlug(artistData.name);

  // Pull press quotes from EPK if available
  const epk = await kvGet<EPKData>(`helm:user:${session.email}:epk`);
  const pressQuotes = epk?.pressQuotes?.filter(q => q && !q.startsWith("[")) ?? [];

  // Auto-derive Apple Music if user hasn't supplied one
  let appleMusic = epk?.socialLinks?.appleMusic;
  if (!appleMusic) {
    const derived = await deriveAppleMusicArtistUrl(
      artistData.spotifyUrl,
      artistData.name
    );
    if (derived) appleMusic = derived;
  }

  // Pull upcoming shows (filter past dates, sort ascending)
  const allShows =
    (await kvGet<UpcomingShow[]>(`helm:artist:${artistData.id}:upcoming-shows`)) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcomingShows = allShows
    .filter((s) => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const data: OneSheetData = {
    artistId: artistData.id,
    artistName: artistData.name,
    slug,
    bio: stripMarkdown(bio || artistData.bio || epk?.shortBio || ""),
    photoUrl: artistData.image || "",
    genres: artistData.genres || [],
    monthlyListeners: artistData.monthlyListeners || 0,
    spotifyFollowers: artistData.spotifyFollowers || 0,
    topTracks: (artistData.topTracks || []).slice(0, 5).map((t) => ({
      name: t.name,
      spotifyUrl: t.spotifyUrl,
      albumArt: t.albumArt,
    })),
    latestRelease: artistData.latestRelease
      ? {
          name: artistData.latestRelease.name,
          date: artistData.latestRelease.releaseDate,
          albumArt: artistData.latestRelease.albumArt,
          spotifyUrl: artistData.latestRelease.spotifyUrl,
        }
      : null,
    socialLinks: {
      spotify: artistData.spotifyUrl || undefined,
      ...(epk?.socialLinks ?? {}),
      appleMusic,
    },
    pressQuotes,
    // Manager email is the public-facing artistname@helmos.co alias.
    // (Task 4 will forward replies to the artist's real email.)
    bookingEmail: artistEmail(slug),
    upcomingShows: upcomingShows.length ? upcomingShows : undefined,
    createdAt: new Date().toISOString(),
  };

  await kvSet(`onesheet:${slug}`, data);
  // Also save to the artist-keyed path for the new API route
  await kvSet(`helm:artist:${artistData.id}:one-sheet-data`, data);
  // Reverse mapping so the inbound-mail webhook can forward
  // {slug}@helmos.co to the artist's real email (Task 4).
  await kvSet(`helm:slug_email:${slug}`, session.email);

  // Report which user-supplied socials are still missing so the
  // frontend can prompt the artist to add them via the Links tab.
  const missingSocials: string[] = [];
  if (!data.socialLinks.instagram) missingSocials.push("instagram");
  if (!data.socialLinks.youtube) missingSocials.push("youtube");
  if (!data.socialLinks.tiktok) missingSocials.push("tiktok");
  if (!data.socialLinks.appleMusic) missingSocials.push("appleMusic");

  return NextResponse.json({
    url: `https://helmos.co/one-sheet/${slug}`,
    legacyUrl: `https://helmos.co/${slug}`,
    slug,
    managerEmail: data.bookingEmail,
    missingSocials,
  });
}
