import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { fetchArtistData } from "@/lib/spotify";
import { kvGet, kvSet } from "@/lib/kv";
import { toSlug } from "@/lib/email";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface EPKData {
  artistId: string;
  artistName: string;
  artistSlug: string;
  photoUrl: string;
  genres: string[];
  monthlyListeners: number;
  monthlyListenersFormatted: string;
  spotifyFollowers: number;
  spotifyFollowersFormatted: string;
  topTracks: { id: string; name: string; albumArt: string; spotifyUrl: string }[];
  latestRelease: {
    name: string;
    albumArt: string;
    releaseDate: string;
    spotifyUrl: string;
  } | null;
  spotifyUrl: string;
  socialLinks: {
    spotify?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    website?: string;
  };
  shortBio: string;
  longBio: string;
  artistStatement: string;
  pressQuotes: string[];
  createdAt: string;
  updatedAt: string;
}

async function generateBios(
  artistName: string,
  genres: string[],
  monthlyListeners: string,
  followers: string,
  topTracks: string[],
  latestRelease: string | null,
  bigWin: string | null
): Promise<{ shortBio: string; longBio: string; artistStatement: string }> {
  const genreStr = genres.slice(0, 3).join(", ") || "independent";
  const tracksStr = topTracks.slice(0, 5).join(", ");

  const prompt = `Write three pieces of artist bio content for an Electronic Press Kit (EPK).

Artist: ${artistName}
Genre: ${genreStr}
Monthly Listeners: ${monthlyListeners}
Spotify Followers: ${followers}
Notable Tracks: ${tracksStr}
${latestRelease ? `Latest Release: ${latestRelease}` : ""}
${bigWin ? `Recent Milestone: ${bigWin}` : ""}

Write exactly three sections separated by "---":

SECTION 1 - SHORT BIO (150 words max):
Third person. For press use. Lead with genre and distinctive quality, then stats, then recent work. Punchy and quotable.

---

SECTION 2 - LONG BIO (400 words max):
Third person. Full press bio. Origin story, musical development, defining moments, current status, future direction. Suitable for major press outlets.

---

SECTION 3 - ARTIST STATEMENT (100 words max):
First person. Personal, authentic voice. What drives their music, their artistic vision, what they want listeners to feel. Not hype — genuine.

Return only the three sections with "---" separators, no labels or headers.`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  const parts = text.split(/\n---\n/).map((p) => p.trim());

  return {
    shortBio: parts[0] ?? "",
    longBio: parts[1] ?? "",
    artistStatement: parts[2] ?? "",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const slug = searchParams.get("slug");

  if (!email && !slug) {
    return NextResponse.json(
      { error: "Provide email or slug query param" },
      { status: 400 }
    );
  }

  let kvKey: string;
  if (slug) {
    kvKey = `helm:epk:slug:${slug}`;
    const emailForSlug = await kvGet<string>(kvKey);
    if (!emailForSlug) {
      return NextResponse.json({ error: "EPK not found" }, { status: 404 });
    }
    kvKey = `helm:user:${emailForSlug}:epk`;
  } else {
    kvKey = `helm:user:${email}:epk`;
  }

  const data = await kvGet<EPKData>(kvKey);
  if (!data) {
    return NextResponse.json({ error: "EPK not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { artistId?: string };
  if (!body.artistId) {
    return NextResponse.json({ error: "Missing artistId" }, { status: 400 });
  }

  const { artistId } = body;

  const artist = await fetchArtistData(artistId);

  const artistSlug = toSlug(artist.name);

  // Load existing social links from KV profile if available
  const profileKey = `helm:user:${session.email}:profile`;
  const existingProfile = await kvGet<{ socialLinks?: EPKData["socialLinks"] }>(profileKey);
  const socialLinks: EPKData["socialLinks"] = {
    spotify: artist.spotifyUrl,
    ...(existingProfile?.socialLinks ?? {}),
  };

  const topTrackNames = artist.topTracks.map((t) => t.name);
  const latestReleaseName = artist.latestRelease?.name ?? null;

  const { shortBio, longBio, artistStatement } = await generateBios(
    artist.name,
    artist.genres,
    artist.monthlyListenersFormatted,
    artist.spotifyFollowersFormatted,
    topTrackNames,
    latestReleaseName,
    artist.bigWin
  );

  const pressQuotes = [
    "[Add real quote here]",
    "[Add real quote here]",
    "[Add real quote here]",
  ];

  const epkData: EPKData = {
    artistId,
    artistName: artist.name,
    artistSlug,
    photoUrl: artist.image,
    genres: artist.genres,
    monthlyListeners: artist.monthlyListeners,
    monthlyListenersFormatted: artist.monthlyListenersFormatted,
    spotifyFollowers: artist.spotifyFollowers,
    spotifyFollowersFormatted: artist.spotifyFollowersFormatted,
    topTracks: artist.topTracks.slice(0, 6).map((t) => ({
      id: t.id,
      name: t.name,
      albumArt: t.albumArt,
      spotifyUrl: t.spotifyUrl,
    })),
    latestRelease: artist.latestRelease
      ? {
          name: artist.latestRelease.name,
          albumArt: artist.latestRelease.albumArt,
          releaseDate: artist.latestRelease.releaseDate,
          spotifyUrl: artist.latestRelease.spotifyUrl,
        }
      : null,
    spotifyUrl: artist.spotifyUrl,
    socialLinks,
    shortBio,
    longBio,
    artistStatement,
    pressQuotes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Store EPK data
  const kvKey = `helm:user:${session.email}:epk`;
  await kvSet(kvKey, epkData);

  // Store slug → email mapping for public page lookup
  await kvSet(`helm:epk:slug:${artistSlug}`, session.email);

  return NextResponse.json({
    ...epkData,
    publicUrl: `/epk/${artistSlug}`,
  });
}
