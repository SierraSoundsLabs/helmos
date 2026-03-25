import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import {
  saveOpportunity,
  getUserOpportunities,
  getRecentTypes,
  recordSurfacedTypes,
  setLastScanTime,
} from "@/lib/tasks";
import type { OpportunityTask, OpportunityType } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALL_TYPES: OpportunityType[] = ["festival", "playlist", "press", "tiktok_growth", "sync"];

function generateId() {
  return `opp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function braveSearch(query: string): Promise<{ title: string; url: string; description: string }[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      { headers: { "X-Subscription-Token": apiKey, Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.web?.results ?? []).map((r: { title: string; url: string; description?: string }) => ({
      title: r.title,
      url: r.url,
      description: r.description ?? "",
    }));
  } catch {
    return [];
  }
}

interface ScannedOpportunity {
  type: OpportunityType;
  title: string;
  description: string;
  actionUrl?: string;
  deadline?: string;
}

/** Pick which types to focus on this scan — de-prioritize recently surfaced ones */
function pickTargetTypes(
  recentTypes: OpportunityType[],
  overrideTypes?: OpportunityType[],
): OpportunityType[] {
  if (overrideTypes?.length) return overrideTypes;
  // Count how many times each type appears in recent history
  const recentSet = new Set(recentTypes.slice(0, 3)); // last 3 are "hot"
  const prioritized = ALL_TYPES.filter(t => !recentSet.has(t));
  const deprioritized = ALL_TYPES.filter(t => recentSet.has(t));
  // Return non-recent first, then recent — take up to 4 for search queries
  return [...prioritized, ...deprioritized].slice(0, 4);
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({})) as {
    artistId?: string;
    artistName?: string;
    genres?: string[];
    monthlyListeners?: number;
    targetTypes?: OpportunityType[];
    forceRefresh?: boolean;
  };

  const artistId = body.artistId ?? session.artistId;
  const artistName = body.artistName ?? "this artist";
  const genres = body.genres ?? [];
  const monthlyListeners = body.monthlyListeners ?? 0;

  const primaryGenre = genres[0] ?? "indie";

  // Check existing opportunities to avoid duplicates
  const existing = await getUserOpportunities(session.email);
  const existingTitles = new Set(existing.map(o => o.title.toLowerCase()));

  // Determine which types to surface this scan (rotate away from recently seen)
  const recentTypes = await getRecentTypes(session.email);
  const targetTypes = pickTargetTypes(recentTypes, body.targetTypes);

  let opportunities: ScannedOpportunity[] = [];

  const hasBrave = !!process.env.BRAVE_API_KEY;

  if (hasBrave) {
    const typeQueries: Record<OpportunityType, string> = {
      festival:      `${primaryGenre} music festival open submissions 2026`,
      playlist:      `${primaryGenre} playlist curator submissions SubmitHub 2026`,
      press:         `${primaryGenre} music blog interview submissions independent artists 2026`,
      sync:          `${primaryGenre} sync licensing music supervisors submissions 2026`,
      tiktok_growth: `${primaryGenre} TikTok music promotion strategy independent artists 2026`,
    };

    const searches = targetTypes.map(type => ({ type, query: typeQueries[type] }));

    const searchResults = await Promise.all(
      searches.map(async ({ type, query }) => ({ type, results: await braveSearch(query) })),
    );

    const allResults = searchResults.flatMap(({ type, results }) =>
      results.map(r => ({ type, ...r })),
    );

    if (allResults.length > 0) {
      const prompt = `You are evaluating music industry opportunities for the artist "${artistName}" (genres: ${genres.join(", ")}, monthly listeners: ${monthlyListeners.toLocaleString()}).

Here are web search results for music opportunities:
${allResults.map((r, i) => `${i + 1}. [${r.type}] ${r.title}\nURL: ${r.url}\n${r.description}`).join("\n\n")}

Select up to 5 that are genuinely actionable and relevant for this artist. For each, extract:
- type: one of "festival", "playlist", "press", "tiktok_growth", "sync"
- title: concise opportunity name (max 60 chars)
- description: 1-2 sentences about what the opportunity is and why it fits this artist
- actionUrl: the URL to apply or learn more
- deadline: deadline if mentioned (e.g. "March 31, 2026"), or omit if not found

${monthlyListeners < 10000 ? 'Also add one "tiktok_growth" opportunity: suggest the artist optimize their TikTok profile for growth since they have under 10K listeners.' : ""}

Return a JSON array only, no other text:
[{"type":"...","title":"...","description":"...","actionUrl":"...","deadline":"..."}]`;

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          opportunities = JSON.parse(jsonMatch[0]);
        } catch {
          opportunities = [];
        }
      }
    }
  }

  // Fallback: use Claude's knowledge to generate opportunities
  if (opportunities.length === 0) {
    const typesHint = targetTypes.join(", ");
    const prompt = `You are a music industry expert. Generate 4-5 realistic, actionable opportunities for the artist "${artistName}" (genres: ${genres.join(", ")}, monthly listeners: ${monthlyListeners.toLocaleString()}).

Focus on these opportunity types this scan (rotate variety): ${typesHint}

Include a mix of these types (use the exact string values):
- "festival": Music festivals accepting submissions
- "playlist": Playlist curators accepting submissions on SubmitHub or similar
- "press": Music blogs or podcasts seeking artist interviews
- "sync": Sync licensing opportunities
${monthlyListeners < 10000 ? '- "tiktok_growth": TikTok profile optimization recommendation' : ""}

For each opportunity provide:
- type: one of the types above
- title: concise name (max 60 chars)
- description: 1-2 sentences — be specific about what the opportunity is and why it fits this artist's genre/stage
- actionUrl: a realistic URL (can be generic like "https://www.submithub.com" for playlists)
- deadline: realistic deadline if applicable, otherwise omit

Return a JSON array only:
[{"type":"...","title":"...","description":"...","actionUrl":"..."}]`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        opportunities = JSON.parse(jsonMatch[0]);
      } catch {
        opportunities = [];
      }
    }
  }

  // Filter duplicates, save, cap at 5
  const now = new Date().toISOString();
  const saved: OpportunityTask[] = [];

  for (const opp of opportunities.slice(0, 5)) {
    if (!opp.title || !opp.description) continue;
    if (existingTitles.has(opp.title.toLowerCase())) continue;

    const task: OpportunityTask = {
      id: generateId(),
      userEmail: session.email,
      artistId,
      artistName,
      type: opp.type ?? "press",
      title: opp.title,
      description: opp.description,
      actionUrl: opp.actionUrl,
      deadline: opp.deadline,
      status: "new",
      createdAt: now,
      updatedAt: now,
    };

    await saveOpportunity(task);
    saved.push(task);
  }

  // Record which types were surfaced + update last scan time
  if (saved.length > 0) {
    const surfacedTypes = [...new Set(saved.map(t => t.type))];
    await recordSurfacedTypes(session.email, surfacedTypes);
  }
  await setLastScanTime(session.email, Date.now());

  return new Response(JSON.stringify({ tasks: saved, count: saved.length }), {
    headers: { "Content-Type": "application/json" },
  });
}
