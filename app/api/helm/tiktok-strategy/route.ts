import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { fetchArtistData } from "@/lib/spotify";
import { kvSet } from "@/lib/kv";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface AudioFeatures {
  tempo: number;
  energy: number;
  danceability: number;
  valence: number;
}

async function fetchAudioFeatures(
  trackId: string,
  accessToken: string
): Promise<AudioFeatures | null> {
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/audio-features/${trackId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      tempo: data.tempo as number,
      energy: data.energy as number,
      danceability: data.danceability as number,
      valence: data.valence as number,
    };
  } catch {
    return null;
  }
}

async function braveSearch(query: string): Promise<string> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return "";

  try {
    const params = new URLSearchParams({ q: query, count: "5" });
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const results = (data.web?.results ?? []) as Array<{
      title: string;
      description: string;
    }>;
    return results
      .slice(0, 5)
      .map((r) => `• ${r.title}: ${r.description}`)
      .join("\n");
  } catch {
    return "";
  }
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

  const genreStr = artist.genres.slice(0, 2).join(", ") || "independent";
  const topTracks = artist.topTracks.slice(0, 6);

  // Fetch audio features for top tracks if access token available
  const accessToken = process.env.SPOTIFY_ACCESS_TOKEN;
  const audioFeaturesMap: Record<string, AudioFeatures> = {};

  if (accessToken && topTracks.length > 0) {
    const featurePromises = topTracks.map(async (t) => {
      const features = await fetchAudioFeatures(t.id, accessToken);
      if (features) audioFeaturesMap[t.id] = features;
    });
    await Promise.all(featurePromises);
  }

  // Brave search for TikTok trends
  const [trendSearch, soundSearch] = await Promise.all([
    braveSearch(`trending TikTok sounds ${genreStr} 2026`),
    braveSearch(`TikTok music trends ${genreStr} viral 2026`),
  ]);

  const trendContext =
    [trendSearch, soundSearch].filter(Boolean).join("\n\n") ||
    "No trend data available — use your knowledge of current TikTok trends.";

  // Build track summaries for the prompt
  const trackSummaries = topTracks
    .map((t) => {
      const af = audioFeaturesMap[t.id];
      if (af) {
        return `- "${t.name}" (BPM: ${Math.round(af.tempo)}, Energy: ${Math.round(af.energy * 100)}%, Danceability: ${Math.round(af.danceability * 100)}%, Mood: ${af.valence > 0.5 ? "Upbeat" : "Melancholic"})`;
      }
      return `- "${t.name}"`;
    })
    .join("\n");

  const featuredTrack = topTracks[0]?.name ?? "their latest track";

  const prompt = `You are a TikTok music marketing strategist. Generate a comprehensive TikTok strategy for this artist.

Artist: ${artist.name}
Genre: ${genreStr}
Monthly Listeners: ${artist.monthlyListenersFormatted}
Top Tracks:
${trackSummaries}

Current TikTok & Music Trends Research:
${trendContext}

Generate a TikTok strategy with these exact four sections. Separate each with "---":

SECTION 1 - TRACK ANALYSIS:
Analyze which of the artist's tracks have the highest TikTok viral potential. Be specific about why each track does or doesn't work for the platform (hook strength, loop-ability, trend compatibility, sound clip potential). Identify the #1 track to push and explain the strategy.

---

SECTION 2 - HOOK IDEAS (JSON array):
Write 5 specific video hook ideas for "${featuredTrack}". Each hook describes the first 3 seconds that make someone stop scrolling. Format as a JSON array of strings: ["hook1", "hook2", "hook3", "hook4", "hook5"]

---

SECTION 3 - 30-DAY POSTING PLAN:
A practical week-by-week content calendar:
- Week 1: [3 specific video ideas with format]
- Week 2: [3 specific video ideas with format]
- Week 3: [3 specific video ideas with format]
- Week 4: [3 specific video ideas with format]
Include: best posting times for ${genreStr} audience, top 10 hashtags to use

---

SECTION 4 - TREND OPPORTUNITIES (JSON array):
3 specific TikTok trends/sounds/challenges the artist should jump on RIGHT NOW. Format as JSON array: [{"trend": "name", "why": "reason", "howTo": "specific execution"}]

Return only the four sections with "---" separators.`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  const parts = text.split(/\n---\n/).map((p) => p.trim());

  const trackAnalysis = parts[0] ?? "";
  const postingPlan = parts[2] ?? "";

  // Parse hook ideas JSON
  let hookIdeas: string[] = [];
  try {
    const hooksRaw = parts[1] ?? "[]";
    const jsonMatch = hooksRaw.match(/\[[\s\S]*\]/);
    if (jsonMatch) hookIdeas = JSON.parse(jsonMatch[0]) as string[];
  } catch {
    hookIdeas = (parts[1] ?? "").split("\n").filter((l) => l.trim().startsWith('"') || l.trim().startsWith("-")).map((l) => l.replace(/^[-"•\s]+/, "").replace(/",$/, "").trim()).filter(Boolean);
  }

  // Parse trend opportunities JSON
  let trendOpportunities: string[] = [];
  try {
    const trendsRaw = parts[3] ?? "[]";
    const jsonMatch = trendsRaw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        trend: string;
        why: string;
        howTo: string;
      }>;
      trendOpportunities = parsed.map(
        (t) => `${t.trend}: ${t.why} — ${t.howTo}`
      );
    }
  } catch {
    trendOpportunities = [parts[3] ?? ""].filter(Boolean);
  }

  const result = {
    trackAnalysis,
    hookIdeas,
    postingPlan,
    trendOpportunities,
    generatedAt: new Date().toISOString(),
  };

  await kvSet(`helm:user:${session.email}:tiktok-strategy`, result);

  return NextResponse.json(result);
}
