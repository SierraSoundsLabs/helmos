import { NextRequest, NextResponse } from "next/server";
import { analyzeArtist } from "@/lib/claude";
import type { ArtistData } from "@/lib/spotify";

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

  try {
    const analysis = await analyzeArtist(artistData);
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json({ error: "Failed to analyze artist" }, { status: 500 });
  }
}
