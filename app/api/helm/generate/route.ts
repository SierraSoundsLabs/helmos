import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { decodeSession, COOKIE_NAME } from "@/lib/session";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type DocType = "one-sheet" | "bio" | "press-release" | "pitch-email";

function getPrompt(type: DocType, artist: Record<string, unknown>): string {
  const a = artist as {
    name?: string; genres?: string[]; monthlyListeners?: string; spotifyFollowers?: string;
    spotifyPopularity?: number; allReleases?: {name:string;releaseDate:string;type:string;totalTracks?:number}[];
    topSong?: {name:string;streamEstimate:string}; image?: string;
  };

  const name = a.name || "the artist";
  const genres = (a.genres || []).join(", ") || "independent";
  const listeners = a.monthlyListeners || "growing audience";
  const followers = a.spotifyFollowers || "—";
  const latestRelease = (a.allReleases || [])[0];
  const top = a.topSong?.name || "their latest single";
  const topStreams = a.topSong?.streamEstimate || "";

  switch (type) {
    case "one-sheet":
      return `Create a professional music industry one-sheet for ${name}.

ARTIST DATA:
- Name: ${name}
- Genres: ${genres}
- Monthly Listeners: ${listeners}
- Spotify Followers: ${followers}
- Spotify Popularity: ${a.spotifyPopularity ?? "—"}/100
- Most-streamed track: ${top} (~${topStreams} streams)
- Latest release: ${latestRelease?.name || "N/A"} (${latestRelease?.releaseDate || "N/A"})
- Total releases: ${(a.allReleases || []).length}

Write a complete one-sheet in clean, formatted markdown. Include:
1. **Artist Name & Tagline** (one punchy sentence)
2. **Bio** (3 sentences, press-ready, 3rd person)  
3. **Stats** (formatted bullets: listeners, followers, streams, releases)
4. **Notable Releases** (top 3-5 releases with dates)
5. **Genre & Sound** (2-3 sentences describing their sonic identity)
6. **Why Now** (1 paragraph — what makes this artist relevant right now)
7. **Contact** (For booking/press: artists@goodmornmusic.com)

Keep it tight. One page max. Suitable for sending to labels, booking agents, and press.`;

    case "bio": {
      const interviewAnswers = (artist.interviewAnswers as string | undefined) ?? "";
      const interviewSection = interviewAnswers
        ? `\nARTIST INTERVIEW ANSWERS:\n${interviewAnswers}\n`
        : "";
      return `Write a professional artist bio for ${name}.

ARTIST DATA:
- Name: ${name}
- Genres: ${genres}
- Monthly Listeners: ${listeners}
- Spotify Followers: ${followers}
- Most-streamed track: ${top} (~${topStreams} streams)
- Latest release: ${latestRelease?.name || "N/A"} (${latestRelease?.releaseDate || "N/A"})
${interviewSection}
Write THREE versions of the bio:

**Short Bio (50 words)** — For social profiles, streaming platforms
**Medium Bio (150 words)** — For press kits, booking inquiries
**Long Bio (300 words)** — For label pitches, press releases, website

Write in third person. Be compelling but authentic. Avoid clichés like "unique sound" or "genre-defying". Prioritize the artist's own words and story from the interview answers over generic Spotify stats. Make it specific and human.`;
    }

    case "press-release":
      return `Write a professional press release for ${name}'s most recent release.

ARTIST DATA:
- Name: ${name}
- Genres: ${genres}  
- Monthly Listeners: ${listeners}
- Latest release: ${latestRelease?.name || "latest project"} (${latestRelease?.type || "release"}, ${latestRelease?.releaseDate || "recently"})
- Most-streamed track: ${top}
- Total catalog: ${(a.allReleases || []).length} releases

Write a complete press release in standard format:
- Headline (compelling, not generic)
- FOR IMMEDIATE RELEASE
- Dateline: [City, Date]
- Lead paragraph (who, what, when, where, why)
- Body (2-3 paragraphs about the release, artist background, significance)
- Quote (attributed to ${name}, 1-2 sentences, authentic-sounding)
- About section (3 sentences)
- Contact: artists@goodmornmusic.com

Keep it under 400 words. Write it like a real music journalist would.`;

    case "pitch-email":
      return `Write a playlist curator pitch email for ${name}.

ARTIST DATA:
- Name: ${name}
- Genres: ${genres}
- Monthly Listeners: ${listeners}
- Featured track to pitch: ${top} (~${topStreams} streams)
- Latest release: ${latestRelease?.name || "N/A"} (${latestRelease?.releaseDate || "N/A"})

Write a pitch email template that:
- Subject line (specific, not generic)
- Opening (reference the curator's playlist/platform — use [PLAYLIST NAME] as placeholder)
- Why this track fits their playlist (specific, references genre/vibe/data)
- 2-3 sentences about the artist's momentum
- Clear ask (add to [PLAYLIST NAME])
- Links: [SPOTIFY LINK] and [SOUNDCLOUD LINK] placeholders
- Signature

Keep it under 200 words. Curators get 100s of pitches. Be specific, brief, and confident. No "I hope this email finds you well."`;

    default:
      return `Generate content for ${name}.`;
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? decodeSession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, artistData, interviewAnswers } = await req.json() as {
    type: DocType;
    artistData: Record<string, unknown>;
    interviewAnswers?: string;
  };
  if (!type || !artistData) {
    return NextResponse.json({ error: "Missing type or artistData" }, { status: 400 });
  }

  // Inject interview answers into artistData for bio generation
  const enrichedData = interviewAnswers ? { ...artistData, interviewAnswers } : artistData;
  const prompt = getPrompt(type, enrichedData);

  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const content = msg.content[0].type === "text" ? msg.content[0].text : "";

  // Auto-save bio to KV so it appears in the Links tab
  if (type === "bio" && content && artistData.id) {
    const bioPayload = {
      artistId: artistData.id as string,
      artistName: (artistData.name as string) ?? "Unknown",
      content,
      generatedFrom: interviewAnswers ? "interview" : "spotify-only",
    };
    // Fire-and-forget save
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "https://helmos.co"}/api/helm/bio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward session cookie so auth passes
        Cookie: `helm_session=${token}`,
      },
      body: JSON.stringify(bioPayload),
    }).catch(() => {});
  }

  return NextResponse.json({ content, type });
}
