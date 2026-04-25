import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";

export interface SavedBio {
  artistId: string;
  artistName: string;
  short: string;   // ~50 words
  medium: string;  // ~150 words
  long: string;    // ~300 words
  raw: string;     // full generated markdown
  savedAt: string;
  generatedFrom?: "interview" | "spotify-only";
}

// GET: fetch saved bio for an artist
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artistId = req.nextUrl.searchParams.get("artistId");
  if (!artistId) return NextResponse.json({ error: "artistId required" }, { status: 400 });

  const bio = await kvGet<SavedBio>(`helm:artist:${artistId}:bio`);
  return NextResponse.json({ bio: bio ?? null });
}

// POST: save a generated bio
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { artistId, artistName, content, generatedFrom } = await req.json() as {
    artistId: string;
    artistName: string;
    content: string;
    generatedFrom?: "interview" | "spotify-only";
  };

  if (!artistId || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Parse the three versions out of the generated markdown
  const shortMatch = content.match(/\*\*Short Bio[^*]*\*\*[^\n]*\n+([\s\S]+?)(?=\n{2,}\*\*|\n{2,}#{1,3}|$)/i);
  const mediumMatch = content.match(/\*\*Medium Bio[^*]*\*\*[^\n]*\n+([\s\S]+?)(?=\n{2,}\*\*|\n{2,}#{1,3}|$)/i);
  const longMatch = content.match(/\*\*Long Bio[^*]*\*\*[^\n]*\n+([\s\S]+?)(?=\n{2,}\*\*|\n{2,}#{1,3}|$)/i);

  const bio: SavedBio = {
    artistId,
    artistName,
    short: shortMatch?.[1]?.trim() ?? content.slice(0, 300).trim(),
    medium: mediumMatch?.[1]?.trim() ?? content.slice(0, 600).trim(),
    long: longMatch?.[1]?.trim() ?? content.trim(),
    raw: content,
    savedAt: new Date().toISOString(),
    generatedFrom: generatedFrom ?? "spotify-only",
  };

  await kvSet(`helm:artist:${artistId}:bio`, bio, 60 * 60 * 24 * 365);

  return NextResponse.json({ ok: true, bio });
}
