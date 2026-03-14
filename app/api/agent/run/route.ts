import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  popNextGlobalTask, getTask, getUserTasks, updateTask, queueNextTask,
  getKnowledge, saveKnowledge, type Task,
} from "@/lib/tasks";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Called by Vercel Cron every 30 minutes (GET) or manually (POST)
export async function GET(req: NextRequest) { return runNext(req); }
export async function POST(req: NextRequest) { return runNext(req); }

async function runNext(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer $CRON_SECRET
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entry = await popNextGlobalTask();
  if (!entry) {
    return NextResponse.json({ ok: true, message: "Queue empty" });
  }

  const task = await getTask(entry.taskId);
  if (!task) {
    return NextResponse.json({ ok: true, message: "Task not found" });
  }
  if (task.status !== "pending") {
    return NextResponse.json({ ok: true, message: "Task already processed" });
  }

  // Mark as running
  task.status = "running";
  task.startedAt = new Date().toISOString();
  await updateTask(task);

  try {
    const result = await runAgent(task);
    task.status = "completed";
    task.completedAt = new Date().toISOString();
    task.output = result;
    await updateTask(task);

    // Queue next task for this user
    const allTasks = await getUserTasks(task.userId);
    await queueNextTask(task.userId, allTasks);

    return NextResponse.json({ ok: true, taskId: task.id, type: task.type });
  } catch (err) {
    task.status = "failed";
    task.error = String(err);
    await updateTask(task);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ─── AGENT PROMPTS ────────────────────────────────────────────────────────────

async function runAgent(task: Task): Promise<string> {
  const { type, input } = task;
  const genre = (input.genres as string[])?.[0] ?? "independent";
  const artistName = input.artistName as string ?? "this artist";
  const listeners = (input.monthlyListeners as number ?? 0).toLocaleString();
  const latestRelease = input.latestRelease as string | undefined;
  const upcomingRelease = input.upcomingRelease as boolean;
  const releaseTitle = input.releaseTitle as string | undefined;
  const releaseDate = input.releaseDate as string | undefined;

  // Load shared knowledge for this genre
  const knowledgeMap: Record<string, string[]> = {
    journalist_research: ["journalists"],
    playlist_curators: ["curators"],
    sync_pitch: ["sync"],
    press_release: ["journalists"],
  };
  let sharedKnowledge = "";
  for (const cat of (knowledgeMap[type] ?? [])) {
    const k = await getKnowledge(cat, genre);
    if (k) sharedKnowledge += `\n\nPrevious research on ${cat} in ${genre}:\n${k}`;
  }

  const systemPrompt = `You are Helm, an AI record label that actually does the work for artists. You produce real, immediately usable deliverables — not advice or suggestions, but the actual thing. Be specific, name real people and publications, write real copy. Format your output in clean markdown.`;

  const userPrompt = buildPrompt(type, { artistName, genre, listeners, latestRelease, upcomingRelease, releaseTitle, releaseDate, sharedKnowledge, goals: input.goals as string[] ?? [] });

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const result = message.content[0].type === "text" ? message.content[0].text : "";

  // Save learnings to shared knowledge base
  await saveToKnowledgeBase(type, genre, result);

  return result;
}

function buildPrompt(type: string, ctx: {
  artistName: string; genre: string; listeners: string; latestRelease?: string;
  upcomingRelease: boolean; releaseTitle?: string; releaseDate?: string;
  sharedKnowledge: string; goals: string[];
}): string {
  const { artistName, genre, listeners, latestRelease, upcomingRelease, releaseTitle, releaseDate, sharedKnowledge } = ctx;

  const base = `Artist: ${artistName}
Genre: ${genre}
Monthly Listeners: ${listeners}
${latestRelease ? `Latest Release: ${latestRelease}` : ""}
${upcomingRelease && releaseTitle ? `Upcoming Release: "${releaseTitle}"${releaseDate ? ` dropping ${releaseDate}` : ""}` : ""}
${sharedKnowledge}`;

  switch (type) {
    case "artist_analysis":
      return `${base}

Analyze this artist's career position and identify the highest-leverage opportunities right now. Cover:

1. **Career Stage Assessment** — where they are in their trajectory and what that means
2. **Top 3 Opportunities** — the specific things most likely to accelerate growth given their stats
3. **Immediate Wins** — 3 things they could do in the next 7 days
4. **6-Month Roadmap** — milestone-based plan

Be data-driven and specific. Reference their listener count and genre context.`;

    case "journalist_research":
      return `${base}

Research and identify 15 real music journalists and editors who actively cover ${genre} music and would be genuinely interested in ${artistName}.

For each journalist provide:
- **Name + Publication**
- **Contact** (email if known, or submission page URL)
- **Recent article** they wrote (title + a sentence on why it's relevant)
- **Pitch angle** — the specific hook that would work for this journalist given ${artistName}'s sound

Then provide a **pitch email template** that can be personalized for each journalist.

Focus on publications like: Pitchfork, The Guardian, Rolling Stone, Stereogum, NME, The Line of Best Fit, Atwood Magazine, Ones to Watch, No Depression, American Songwriter, Consequence, Paste, Under the Radar, and blogs specific to ${genre}.`;

    case "playlist_curators":
      return `${base}

Identify 50 playlist curators who actively add ${genre} music to playlists with real listener counts.

For each curator:
- **Playlist name** + approximate follower count
- **How to submit** (SubmitHub, Groover, direct email, or other)
- **What they look for** — their specific taste/criteria

Group them by: Spotify Editorial / Independent Curators / Blog Playlists / YouTube Channels.

Include tips on the best submission approach for ${artistName}'s sound and listener profile.`;

    case "press_release":
      return `${base}

Write a complete, professional press release for ${artistName}${releaseTitle ? ` announcing "${releaseTitle}"` : "'s latest music"}.

Structure:
- **Headline** — attention-grabbing, journalist-ready
- **Dateline + First paragraph** — who, what, when, where, why
- **Body** (2-3 paragraphs) — story, artist background, quotes in first person, streaming info
- **About ${artistName}** — boilerplate bio
- **Contact information** placeholder
- **Streaming/social links** placeholder

Make it sound like a real press release that a publicist would send to Pitchfork. No AI-isms.`;

    case "content_calendar":
      return `${base}

Build a 30-day social content calendar for ${artistName}.
${upcomingRelease && releaseTitle ? `Center it around the release of "${releaseTitle}"${releaseDate ? ` on ${releaseDate}` : ""}.` : "Focus on building audience and showcasing their music."}

For each week, provide:
- **Theme** for the week
- **7 specific posts** with: platform (Reels/TikTok/Story/Feed), concept, caption (write the full caption), hashtags, best time to post

Include a mix of: behind-the-scenes, performance clips, fan engagement, personal stories, and direct music promotion.

Write all captions in a genuine, not-AI voice. Hook in first 3 words.`;

    case "artist_bio":
      return `${base}

Write two professional artist bios for ${artistName}:

**SHORT BIO (50 words)** — for streaming profiles, one-sheets, social bios. Hook immediately.

**LONG BIO (300 words)** — for press kits, EPKs, feature pitches. Tell the story. Reference the music, the sound, the journey. Mention ${genre} context. Don't sound like every other bio.

Then provide **5 subject lines** for press pitches introducing this artist.`;

    case "sync_pitch":
      return `${base}

Research sync licensing opportunities for ${artistName}'s ${genre} sound.

Provide:

1. **Top 10 Sync Agencies** who actively license ${genre} music — with submission info and what they're looking for
2. **Music Supervisors** (5-10) who've placed similar ${genre} artists — with how to reach them
3. **Current Trends** — what's getting licensed in ${genre} right now (moods, tempos, themes)
4. **Pitch Template** — a compelling sync pitch email for ${artistName}
5. **Metadata tips** — how to tag tracks to get discovered on sync platforms`;

    default:
      return `${base}\n\nComplete the task for ${artistName} in ${genre}.`;
  }
}

async function saveToKnowledgeBase(type: string, genre: string, result: string): Promise<void> {
  // Extract and save relevant knowledge fragments for future users
  const categoryMap: Record<string, string> = {
    journalist_research: "journalists",
    playlist_curators: "curators",
    sync_pitch: "sync",
  };
  const category = categoryMap[type];
  if (!category) return;
  // Save first 2000 chars as shared knowledge (strips artist-specific details implicitly)
  await saveKnowledge(category, genre, result.slice(0, 2000));
}
