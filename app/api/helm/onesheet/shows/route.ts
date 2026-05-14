import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";
import type { UpcomingShow } from "@/lib/types";

function showsKey(artistId: string) {
  return `helm:artist:${artistId}:upcoming-shows`;
}

// GET /api/helm/onesheet/shows?artistId=X — list upcoming shows
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const artistId = req.nextUrl.searchParams.get("artistId");
  if (!artistId) {
    return NextResponse.json({ error: "artistId required" }, { status: 400 });
  }
  const shows = (await kvGet<UpcomingShow[]>(showsKey(artistId))) ?? [];
  // Only return future shows (date >= today). Sort ascending by date.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = shows
    .filter((s) => s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ shows: upcoming });
}

// POST /api/helm/onesheet/shows — add a show
// Body: { artistId, date, venue, city?, lineup?, ticketUrl? }
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    artistId?: string;
    date?: string;
    venue?: string;
    city?: string;
    lineup?: string;
    ticketUrl?: string;
  };
  if (!body.artistId || !body.date || !body.venue) {
    return NextResponse.json(
      { error: "artistId, date, and venue required" },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json(
      { error: "date must be ISO 8601 (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const existing = (await kvGet<UpcomingShow[]>(showsKey(body.artistId))) ?? [];
  // Dedupe: same date + venue (case-insensitive) replaces existing
  const filtered = existing.filter(
    (s) =>
      !(s.date === body.date && s.venue.toLowerCase() === body.venue!.toLowerCase())
  );
  const newShow: UpcomingShow = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: body.date,
    venue: body.venue,
    city: body.city,
    lineup: body.lineup,
    ticketUrl: body.ticketUrl,
    addedAt: new Date().toISOString(),
  };
  const next = [...filtered, newShow].sort((a, b) => a.date.localeCompare(b.date));
  await kvSet(showsKey(body.artistId), next);

  return NextResponse.json({ ok: true, show: newShow, shows: next });
}

// DELETE /api/helm/onesheet/shows?artistId=X&id=Y — remove a show
export async function DELETE(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const artistId = req.nextUrl.searchParams.get("artistId");
  const id = req.nextUrl.searchParams.get("id");
  if (!artistId || !id) {
    return NextResponse.json(
      { error: "artistId and id required" },
      { status: 400 }
    );
  }
  const existing = (await kvGet<UpcomingShow[]>(showsKey(artistId))) ?? [];
  const next = existing.filter((s) => s.id !== id);
  await kvSet(showsKey(artistId), next);
  return NextResponse.json({ ok: true, shows: next });
}
