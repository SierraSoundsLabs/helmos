import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";

export interface SongLink {
  id: string;               // slug: artistSlug-songSlug
  artistId: string;
  artistName: string;
  artistSlug: string;
  songName: string;
  songSlug: string;
  albumArt?: string;
  releaseDate?: string;
  releaseType?: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
  soundcloudUrl?: string;
  youtubeUrl?: string;
  tidalUrl?: string;
  amazonUrl?: string;
  presaveUrl?: string;
  customLinks?: { label: string; url: string }[];
  bio?: string;             // short blurb for this song
  createdAt: string;
  updatedAt: string;
}

// GET /api/helm/song-link?artistId=xxx — list all song links for an artist
// GET /api/helm/song-link?id=xxx — get a specific song link
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id = searchParams.get("id");
  const artistId = searchParams.get("artistId");

  if (id) {
    const link = await kvGet<SongLink>(`helm:song-link:${id}`);
    return NextResponse.json({ link: link ?? null });
  }

  if (artistId) {
    const session = getSession(req);
    if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ids = (await kvGet<string[]>(`helm:song-links:${artistId}`)) ?? [];
    const links = await Promise.all(ids.map(i => kvGet<SongLink>(`helm:song-link:${i}`)));
    return NextResponse.json({ links: links.filter(Boolean) });
  }

  return NextResponse.json({ error: "id or artistId required" }, { status: 400 });
}

// POST — create or update a song link
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as Partial<SongLink> & { artistId: string; artistName: string; songName: string };
  if (!body.artistId || !body.songName) {
    return NextResponse.json({ error: "artistId and songName required" }, { status: 400 });
  }

  const artistSlug = body.artistSlug || body.artistName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const songSlug = body.songName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const id = `${artistSlug}-${songSlug}`;

  const existing = await kvGet<SongLink>(`helm:song-link:${id}`);
  const link: SongLink = {
    id,
    artistId: body.artistId,
    artistName: body.artistName,
    artistSlug,
    songName: body.songName,
    songSlug,
    albumArt: body.albumArt,
    releaseDate: body.releaseDate,
    releaseType: body.releaseType,
    spotifyUrl: body.spotifyUrl,
    appleMusicUrl: body.appleMusicUrl,
    soundcloudUrl: body.soundcloudUrl,
    youtubeUrl: body.youtubeUrl,
    tidalUrl: body.tidalUrl,
    amazonUrl: body.amazonUrl,
    presaveUrl: body.presaveUrl,
    customLinks: body.customLinks ?? [],
    bio: body.bio,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await kvSet(`helm:song-link:${id}`, link, 60 * 60 * 24 * 365 * 3);

  // Track IDs per artist
  const ids = (await kvGet<string[]>(`helm:song-links:${body.artistId}`)) ?? [];
  if (!ids.includes(id)) {
    await kvSet(`helm:song-links:${body.artistId}`, [id, ...ids], 60 * 60 * 24 * 365 * 3);
  }

  return NextResponse.json({
    ok: true,
    id,
    url: `https://helmos.co/s/${artistSlug}/${songSlug}`,
    link,
  });
}
