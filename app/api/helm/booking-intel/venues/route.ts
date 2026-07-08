import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findVenuesByCity } from "@/lib/booking-intel";
import type { ArtistData } from "@/lib/spotify";

// One Sonnet call. Comfortably under 15s, but keep the safety cap consistent
// with the rest of the /api/helm/* routes.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { artistData, targetCity }: { artistData: ArtistData; targetCity?: string } =
    await req.json();

  if (!artistData?.name) {
    return NextResponse.json({ error: "artistData required" }, { status: 400 });
  }
  // City is now required — the AI needs a location to name real venues.
  // (Old Bandsintown flow would run without a city and return a global list;
  // Claude can't do that meaningfully.)
  if (!targetCity?.trim()) {
    return NextResponse.json(
      { error: "Enter a city — I need to know where to look for venues.", needsCity: true },
      { status: 400 }
    );
  }

  try {
    const venues = await findVenuesByCity(artistData, targetCity.trim(), 12);
    return NextResponse.json({ venues, count: venues.length });
  } catch (error) {
    console.error("[Booking Intel] Venue scan error:", error);
    return NextResponse.json({ error: "Failed to scan venues" }, { status: 500 });
  }
}
