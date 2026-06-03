import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { enrichVenuesWithContacts, type VenueHit } from "@/lib/booking-intel";

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { venues }: { venues: VenueHit[] } = await req.json();

  if (!Array.isArray(venues) || venues.length === 0) {
    return NextResponse.json({ error: "venues array required" }, { status: 400 });
  }

  try {
    const enriched = await enrichVenuesWithContacts(venues);
    return NextResponse.json({ enriched });
  } catch (error) {
    console.error("[Booking Intel] Contact enrichment error:", error);
    return NextResponse.json({ error: "Failed to enrich contacts" }, { status: 500 });
  }
}
