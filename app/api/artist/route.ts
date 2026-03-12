import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extractArtistId, fetchArtistData, fetchMonthlyListeners } from "@/lib/spotify";

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

    // Enrich with real monthly listeners if user has connected Spotify
    const cookieStore = await cookies();
    const userToken = cookieStore.get("spotify_access_token")?.value;

    if (userToken) {
      const liveStats = await fetchMonthlyListeners(artistId, userToken);
      if (liveStats) {
        artistData.monthlyListeners = liveStats.monthlyListeners;
        artistData.monthlyListenersFormatted = liveStats.monthlyListeners > 0
          ? formatNum(liveStats.monthlyListeners) : "—";
        artistData.spotifyFollowers = liveStats.followers;
        artistData.spotifyFollowersFormatted = liveStats.followers > 0
          ? formatNum(liveStats.followers) : "—";
        artistData.statsSource = "chartmetric"; // reuse badge label as "Spotify"
        artistData.weeklyListeners = liveStats.monthlyListeners;
        artistData.weeklyListenersFormatted = artistData.monthlyListenersFormatted;
        artistData.followers = liveStats.followers;
        artistData.monthlyListenersRaw = liveStats.monthlyListeners;
      }
    }

    return NextResponse.json(artistData);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Artist not found") {
      return NextResponse.json({ error: "Artist not found on Spotify" }, { status: 404 });
    }
    console.error("Artist fetch error:", message);
    return NextResponse.json({ error: "Failed to fetch artist data", detail: message }, { status: 500 });
  }
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
}
