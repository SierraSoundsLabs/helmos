import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";

export interface LiveShowProfile {
  artistId: string;
  targetCities: string;
  showDescription: string;   // band size, set length, vibe
  credentials: string;       // past venues, supports, ticket numbers, press
  bookingGoal: string;       // headline / co-headline / opener / any bill
  wishList: string;          // specific bands/venues/promoters they want
  raw: string;               // full interview summary
  savedAt: string;
}

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artistId = req.nextUrl.searchParams.get("artistId");
  if (!artistId) return NextResponse.json({ error: "artistId required" }, { status: 400 });

  const profile = await kvGet<LiveShowProfile>(`helm:artist:${artistId}:live-show`);
  return NextResponse.json({ profile: profile ?? null });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { artistId, ...fields } = await req.json() as LiveShowProfile;
  if (!artistId) return NextResponse.json({ error: "artistId required" }, { status: 400 });

  const profile: LiveShowProfile = {
    artistId,
    ...fields,
    savedAt: new Date().toISOString(),
  };

  await kvSet(`helm:artist:${artistId}:live-show`, profile, 60 * 60 * 24 * 365);
  return NextResponse.json({ ok: true, profile });
}
