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

  // Cache key includes latest release so it auto-busts when a new song drops.
  // Also write to a bare key (no release slug) so the dashboard's GET prefetch
  // — which doesn't know the release name — can fast-return for returning users.
  const latestSlug = artistData.latestRelease?.name
    ? artistData.latestRelease.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
    : "none";
  const cacheKey = `helm:analysis:${artistData.id}:${latestSlug}`;
  const bareKey = `helm:analysis:${artistData.id}`;
  try {
    const cached = await kvGet(cacheKey);
    if (cached) {
      // Refresh the bare-key copy so the dashboard prefetch keeps hitting
      try { await kvSet(bareKey, cached, CACHE_TTL); } catch { /* non-fatal */ }
      return NextResponse.json(cached);
    }
  } catch {
    // Cache miss or error — continue to fresh analysis
  }

  try {
    const analysis = await analyzeArtist(artistData);
    // Cache under both the versioned key (for cache-busting) and the bare key
    // (for the dashboard's prefetch path)
    try { await kvSet(cacheKey, analysis, CACHE_TTL); } catch { /* non-fatal */ }
    try { await kvSet(bareKey, analysis, CACHE_TTL); } catch { /* non-fatal */ }
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json({ error: "Failed to analyze artist" }, { status: 500 });
  }
}
