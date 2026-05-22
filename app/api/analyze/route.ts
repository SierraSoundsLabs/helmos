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

  // Two cache keys, deliberately different lifetimes:
  //
  // - Versioned key (helm:analysis:{id}:{releaseSlug}) — 7-day TTL. Used by
  //   POST below to decide whether to re-run the (slow, paid) Claude
  //   analysis. The release slug makes it auto-bust when a new song drops.
  //
  // - Bare key (helm:analysis:{id}) — NO EXPIRY. This is the "last known
  //   analysis" the dashboard reads on every load. It must never expire,
  //   or returning users periodically hit the cold path and sit through
  //   the 30-55s "Building your career plan…" screen. (That was the bug:
  //   the bare key used to share the 7-day TTL, so every 7 days the first
  //   returning user ate the full re-analysis.) The dashboard fires a
  //   background POST after rendering, so this key still stays current.
  const latestSlug = artistData.latestRelease?.name
    ? artistData.latestRelease.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
    : "none";
  const cacheKey = `helm:analysis:${artistData.id}:${latestSlug}`;
  const bareKey = `helm:analysis:${artistData.id}`;
  try {
    const cached = await kvGet(cacheKey);
    if (cached) {
      // Refresh the persistent bare-key copy (no TTL)
      try { await kvSet(bareKey, cached); } catch { /* non-fatal */ }
      return NextResponse.json(cached);
    }
  } catch {
    // Cache miss or error — continue to fresh analysis
  }

  try {
    const analysis = await analyzeArtist(artistData);
    // Versioned key keeps the 7-day TTL; bare key is persistent (no TTL).
    try { await kvSet(cacheKey, analysis, CACHE_TTL); } catch { /* non-fatal */ }
    try { await kvSet(bareKey, analysis); } catch { /* non-fatal */ }
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json({ error: "Failed to analyze artist" }, { status: 500 });
  }
}
