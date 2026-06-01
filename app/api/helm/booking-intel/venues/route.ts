import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findRealVenuesFromSimilarArtists } from "@/lib/booking-intel";
import type { ArtistData } from "@/lib/spotify";

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { artistData, targetCity }: { artistData: ArtistData; targetCity?: string } = await req.json();

  if (!artistData?.name) {
    return NextResponse.json({ error: "artistData required" }, { status: 400 });
  }

  try {
    const venues = await findRealVenuesFromSimilarArtists(artistData, targetCity, 5, 6);
    return NextResponse.json({ venues, count: venues.length });
  } catch (error) {
    console.error("[Booking Intel] Venue scan error:", error);
    return NextResponse.json({ error: "Failed to scan venues" }, { status: 500 });
  }
}
