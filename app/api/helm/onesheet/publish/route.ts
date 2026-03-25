import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";
import type { ArtistData } from "@/lib/spotify";
import type { OneSheetData } from "@/lib/types";
import { artistSlug } from "@/lib/types";
import type { EPKData } from "@/app/api/helm/epk/route";

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

  const data: OneSheetData = {
    artistId: artistData.id,
    artistName: artistData.name,
    slug,
    bio: bio || artistData.bio || epk?.shortBio || "",
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
    },
    pressQuotes,
    bookingEmail: epk ? session.email : undefined,
    createdAt: new Date().toISOString(),
  };

  await kvSet(`onesheet:${slug}`, data);
  // Also save to the artist-keyed path for the new API route
  await kvSet(`helm:artist:${artistData.id}:one-sheet-data`, data);

  return NextResponse.json({
    url: `https://helmos.co/one-sheet/${slug}`,
    legacyUrl: `https://helmos.co/${slug}`,
    slug,
  });
}
