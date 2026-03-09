import { NextRequest, NextResponse } from "next/server";
import { extractArtistId, fetchArtistData } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const spotifyUrl = searchParams.get("spotifyUrl");

  if (!spotifyUrl) {
    return NextResponse.json({ error: "Missing spotifyUrl parameter" }, { status: 400 });
  }

  const artistId = extractArtistId(spotifyUrl);
  if (!artistId) {
    return NextResponse.json(
      { error: "Invalid Spotify artist URL. Please paste a link like: https://open.spotify.com/artist/..." },
      { status: 400 }
    );
  }

  try {
    const artistData = await fetchArtistData(artistId);
    return NextResponse.json(artistData);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Artist not found") {
      return NextResponse.json({ error: "Artist not found on Spotify" }, { status: 404 });
    }
    console.error("Artist fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch artist data" }, { status: 500 });
  }
}
