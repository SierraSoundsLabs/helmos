import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { analyzeArtist } from "@/lib/claude";
import type { ArtistData } from "@/lib/spotify";
import { kvGet, kvSet } from "@/lib/kv";

const CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

// GET ?artistId=xxx — returns cached analysis or 404
export async function GET(request: NextRequest) {
  const artistId = request.nextUrl.searchParams.get("artistId");
  if (!artistId) return NextResponse.json({ error: "artistId required" }, { status: 400 });
  const cached = await kvGet(`helm:analysis:${artistId}`);
  if (!cached) return NextResponse.json({ error: "not cached" }, { status: 404 });
  return NextResponse.json(cached);
}

export async function POST(request: NextRequest) {
  let artistData: ArtistData;

  try {
    artistData = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!artistData?.name || !artistData?.id) {
    return NextResponse.json({ error: "Missing artist data" }, { status: 400 });
  }

  // Return cached analysis if available — avoids re-scanning on every login
  const cacheKey = `helm:analysis:${artistData.id}`;
  try {
    const cached = await kvGet(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
  } catch {
    // Cache miss or error — continue to fresh analysis
  }

  try {
    const analysis = await analyzeArtist(artistData);
    // Cache the result
    try { await kvSet(cacheKey, analysis, CACHE_TTL); } catch { /* non-fatal */ }
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json({ error: "Failed to analyze artist" }, { status: 500 });
  }
}
