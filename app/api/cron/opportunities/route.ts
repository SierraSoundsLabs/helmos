import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getUserEmailsWithOpportunities,
  getUserOpportunities,
  saveOpportunity,
  getRecentTypes,
  recordSurfacedTypes,
  setLastScanTime,
  getUserProfile,
} from "@/lib/tasks";
import type { OpportunityTask, OpportunityType } from "@/lib/types";

export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALL_TYPES: OpportunityType[] = ["festival", "playlist", "press", "tiktok_growth", "sync"];

function generateId() {
  return `opp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickTargetTypes(recentTypes: OpportunityType[]): OpportunityType[] {
  const recentSet = new Set(recentTypes.slice(0, 3));
  const prioritized = ALL_TYPES.filter(t => !recentSet.has(t));
  const deprioritized = ALL_TYPES.filter(t => recentSet.has(t));
  return [...prioritized, ...deprioritized].slice(0, 4);
}

interface ScannedOpportunity {
  type: OpportunityType;
  title: string;
  description: string;
  actionUrl?: string;
  deadline?: string;
}

async function scanForUser(userEmail: string): Promise<number> {
  const existing = await getUserOpportunities(userEmail, "new");
  if (existing.length >= 3) return 0; // already has enough

  const profile = await getUserProfile(userEmail);
  const artistName = profile?.artistName ?? "this artist";
  const genres = profile?.genres ?? ["indie"];
  const monthlyListeners = profile?.monthlyListeners ?? 0;
  const artistId = profile?.artistId ?? userEmail;

  const allExisting = await getUserOpportunities(userEmail);
  const existingTitles = new Set(allExisting.map(o => o.title.toLowerCase()));

  const recentTypes = await getRecentTypes(userEmail);
  const targetTypes = pickTargetTypes(recentTypes);

  const prompt = `You are a music industry expert. Generate 4-5 realistic, actionable opportunities for the artist "${artistName}" (genres: ${genres.join(", ")}, monthly listeners: ${monthlyListeners.toLocaleString()}).

Focus on these types this scan: ${targetTypes.join(", ")}

Types (use exact string values):
- "festival": Music festivals accepting submissions
- "playlist": Playlist curators accepting submissions on SubmitHub or similar
- "press": Music blogs or podcasts seeking artist interviews
- "sync": Sync licensing opportunities
${monthlyListeners < 10000 ? '- "tiktok_growth": TikTok profile optimization recommendation' : ""}

For each:
- type: one of the types above
- title: concise name (max 60 chars)
- description: 1-2 sentences specific to this artist's genre/stage
- actionUrl: realistic URL
- deadline: if applicable, otherwise omit

Return JSON array only:
[{"type":"...","title":"...","description":"...","actionUrl":"..."}]`;

  let opportunities: ScannedOpportunity[] = [];

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      opportunities = JSON.parse(jsonMatch[0]);
    }
  } catch {
    return 0;
  }

  const now = new Date().toISOString();
  let savedCount = 0;

  for (const opp of opportunities.slice(0, 5)) {
    if (!opp.title || !opp.description) continue;
    if (existingTitles.has(opp.title.toLowerCase())) continue;

    const task: OpportunityTask = {
      id: generateId(),
      userEmail,
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
    savedCount++;
  }

  if (savedCount > 0) {
    const surfacedTypes = [...new Set(opportunities.slice(0, savedCount).map(t => t.type))];
    await recordSurfacedTypes(userEmail, surfacedTypes);
  }
  await setLastScanTime(userEmail, Date.now());

  return savedCount;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmails = await getUserEmailsWithOpportunities();
  let totalScanned = 0;
  const results: { email: string; added: number }[] = [];

  for (const email of userEmails) {
    const added = await scanForUser(email);
    if (added > 0) {
      results.push({ email, added });
      totalScanned++;
    }
  }

  return NextResponse.json({ ok: true, scanned: totalScanned, results });
}
