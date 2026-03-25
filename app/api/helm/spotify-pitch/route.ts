import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { fetchArtistData } from "@/lib/spotify";
import { kvSet } from "@/lib/kv";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface SpotifyTrack {
  id: string;
  name: string;
  playcount: string;
  albumArt: string;
  previewUrl: string | null;
  spotifyUrl: string;
}

async function fetchTrackData(
  trackId: string,
  accessToken: string
): Promise<{ name: string; album: string; releaseDate: string } | null> {
  try {
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name as string,
      album: data.album?.name as string,
      releaseDate: data.album?.release_date as string,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    artistId?: string;
    trackId?: string;
    releaseNotes?: string;
  };

  if (!body.artistId) {
    return NextResponse.json({ error: "Missing artistId" }, { status: 400 });
  }

  const { artistId, trackId, releaseNotes } = body;

  const artist = await fetchArtistData(artistId);

  let trackInfo: { name: string; album: string; releaseDate: string } | null = null;
  const accessToken = process.env.SPOTIFY_ACCESS_TOKEN;
  if (trackId && accessToken) {
    trackInfo = await fetchTrackData(trackId, accessToken);
  } else if (trackId && !accessToken) {
    // Fall back to finding the track in artist's top tracks
    const match = artist.topTracks.find((t: SpotifyTrack) => t.id === trackId);
    if (match) {
      trackInfo = { name: match.name, album: "", releaseDate: "" };
    }
  }

  const genreStr = artist.genres.slice(0, 3).join(", ") || "independent";
  const trackContext = trackInfo
    ? `Track: "${trackInfo.name}"${trackInfo.album ? ` from "${trackInfo.album}"` : ""}${trackInfo.releaseDate ? ` (${trackInfo.releaseDate})` : ""}`
    : `Featured track: "${artist.topSong?.name ?? artist.topTracks[0]?.name ?? "latest release"}"`;

  const prompt = `Write a Spotify for Artists editorial playlist pitch for this artist.

Artist: ${artist.name}
Genres: ${genreStr}
Monthly Listeners: ${artist.monthlyListenersFormatted}
Spotify Followers: ${artist.spotifyFollowersFormatted}
${trackContext}
${releaseNotes ? `Additional context: ${releaseNotes}` : ""}
${artist.bigWin ? `Recent milestone: ${artist.bigWin}` : ""}

Requirements:
- MUST be under 500 characters total (Spotify's hard limit)
- Tone: concise, confident, specific — not hype, no exclamation points
- Include: genre/mood, a notable stat or milestone, why this track deserves editorial attention
- Write in third person
- No filler phrases like "We're excited to" or "Please consider"
- Get straight to the point

Return ONLY the pitch text, nothing else.`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const pitch = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

  const tips = [
    "Submit at least 7 days before release date for best consideration",
    "Only pitch unreleased tracks — once live, editorial won't consider them",
    "Focus on one playlist per pitch — personalize for the specific mood/genre",
    "Update your artist profile photo and bio before pitching",
    "Use your own monthly listener milestone if it's grown recently",
  ];

  const kvKey = `helm:user:${session.email}:spotify-pitch:${trackId ?? artistId}`;
  await kvSet(kvKey, { pitch, characterCount: pitch.length, tips, generatedAt: new Date().toISOString() });

  return NextResponse.json({
    pitch,
    characterCount: pitch.length,
    tips,
  });
}
