import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { fetchArtistData } from "@/lib/spotify";
import { kvSet } from "@/lib/kv";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type PRType = "release" | "tour" | "milestone";

function buildPressReleasePrompt(
  artistName: string,
  genres: string[],
  monthlyListeners: string,
  type: PRType,
  details: string
): string {
  const genreStr = genres.slice(0, 3).join(", ") || "independent";
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const angleGuide = {
    release: `New music release announcement. Details: ${details}. Focus on the music, the creative process, and what listeners can expect.`,
    tour: `Tour/live show announcement. Details: ${details}. Focus on the dates, cities, and the live experience fans should anticipate.`,
    milestone: `Career milestone announcement. Details: ${details}. Focus on the achievement, its significance, and momentum going forward.`,
  }[type];

  return `Write a professional press release for this artist.

Artist: ${artistName}
Genre: ${genreStr}
Monthly Listeners: ${monthlyListeners}
Date: ${today}
Type: ${type}
Angle: ${angleGuide}

Format Requirements:
- Standard press release format
- Headline: Short, punchy, newsworthy (under 10 words)
- Dateline: City, Date —
- Body: 3-4 paragraphs
  - Para 1: The news (lead paragraph, most important info first)
  - Para 2: Context and background on the artist
  - Para 3: Quote from artist (make it sound natural, not corporate)
  - Para 4: Call to action / where to find more
- Boilerplate: 2-sentence "About ${artistName}" section
- Contact block: [MANAGER NAME] | [EMAIL] | [PHONE]

Tone: Professional music industry press, not overly formal. Trade publication ready.

Return the full press release with all sections clearly formatted. Include "###" at the end to signal end of release.`;
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    artistId?: string;
    type?: PRType;
    details?: string;
  };

  if (!body.artistId || !body.type || !body.details) {
    return NextResponse.json(
      { error: "Missing required fields: artistId, type, details" },
      { status: 400 }
    );
  }

  const validTypes: PRType[] = ["release", "tour", "milestone"];
  if (!validTypes.includes(body.type)) {
    return NextResponse.json(
      { error: "type must be one of: release, tour, milestone" },
      { status: 400 }
    );
  }

  const { artistId, type, details } = body;

  const artist = await fetchArtistData(artistId);

  const prompt = buildPressReleasePrompt(
    artist.name,
    artist.genres,
    artist.monthlyListenersFormatted,
    type,
    details
  );

  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const pressRelease = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

  // Extract headline for email subject
  const firstLine = pressRelease.split("\n").find((l) => l.trim().length > 0) ?? "";
  const subject = firstLine.replace(/^#+\s*/, "").trim() || `${artist.name} — ${type} announcement`;

  const timestamp = Date.now();
  const kvKey = `helm:user:${session.email}:press-release:${timestamp}`;
  await kvSet(kvKey, {
    pressRelease,
    subject,
    type,
    artistId,
    generatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ pressRelease, subject });
}
