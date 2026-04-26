import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTask, updateTask, getUserTasks, queueNextTask } from "@/lib/tasks";
import { kvLpush } from "@/lib/kv";
import Anthropic from "@anthropic-ai/sdk";
import type { Task } from "@/lib/tasks";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Inline the agent logic so we don't depend on self-calling /api/agent/run
async function runTaskInline(task: Task): Promise<string> {
  const { type, input } = task;
  const genre = (input.genres as string[])?.[0] ?? "independent";
  const artistName = (input.artistName as string) ?? "this artist";
  const listeners = ((input.monthlyListeners as number) ?? 0).toLocaleString();
  const latestRelease = input.latestRelease as string | undefined;
  const upcomingRelease = input.upcomingRelease as boolean;
  const releaseTitle = input.releaseTitle as string | undefined;
  const releaseDate = input.releaseDate as string | undefined;

  const base = `Artist: ${artistName}\nGenre: ${genre}\nMonthly Listeners: ${listeners}\n${latestRelease ? `Latest Release: ${latestRelease}` : ""}\n${upcomingRelease && releaseTitle ? `Upcoming Release: "${releaseTitle}"${releaseDate ? ` dropping ${releaseDate}` : ""}` : ""}`;

  const prompts: Record<string, string> = {
    artist_bio: `${base}\n\nWrite two professional artist bios:\n\n**SHORT BIO (50 words)** — for streaming profiles, social bios. Hook immediately.\n\n**LONG BIO (300 words)** — for press kits, EPKs. Tell the story. Reference the music, the sound, the journey.\n\nThen provide **5 subject lines** for press pitches introducing this artist.`,
    artist_analysis: `${base}\n\nAnalyze this artist's career position and identify the highest-leverage opportunities. Cover: Career Stage Assessment, Top 3 Opportunities, Immediate Wins (7 days), 6-Month Roadmap.`,
    journalist_research: `${base}\n\nIdentify 15 real music journalists covering ${genre} music. For each: Name, Publication, Contact, Recent article, Pitch angle. Then provide a pitch email template.`,
    playlist_curators: `${base}\n\nIdentify 50 playlist curators who add ${genre} music. For each: Playlist name, follower count, how to submit, what they look for. Group by: Spotify Editorial / Independent / Blog / YouTube.`,
    press_release: `${base}\n\nWrite a complete press release for ${artistName}${releaseTitle ? ` announcing "${releaseTitle}"` : "'s latest music"}. Include headline, dateline, body, quote, about section, contact placeholder.`,
    content_calendar: `${base}\n\nBuild a 30-day social content calendar for ${artistName}. For each week: theme + 7 specific posts with platform, concept, full caption, hashtags, best time to post.`,
    sync_pitch: `${base}\n\nResearch sync licensing opportunities for ${artistName}'s ${genre} sound. Include: Top 10 sync agencies, Music supervisors, Current trends, Pitch template, Metadata tips.`,
  };

  const prompt = prompts[type] ?? `${base}\n\nComplete the task for ${artistName} in ${genre}.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    system: "You are Helm, an AI record label that produces real, immediately usable deliverables — not advice, but the actual thing. Be specific, name real people and publications, write real copy. Format in clean markdown.",
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await req.json() as { taskId: string };
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await getTask(taskId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Mark as running immediately
  const running: Task = { ...task, status: "running", startedAt: new Date().toISOString(), completedAt: null, error: null };
  await updateTask(running);

  try {
    const result = await runTaskInline(running);

    const completed: Task = { ...running, status: "completed", completedAt: new Date().toISOString(), output: result };
    await updateTask(completed);

    // Queue next pending task if any
    const allTasks = await getUserTasks(task.userId);
    await queueNextTask(task.userId, allTasks);

    // Also kick the global queue runner for remaining tasks
    const baseUrl = req.nextUrl.origin;
    const cronSecret = process.env.CRON_SECRET ?? "";
    fetch(`${baseUrl}/api/agent/run`, {
      method: "POST",
      headers: { ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}) },
    }).catch(() => {});

    return NextResponse.json({ ok: true, taskId, status: "completed" });
  } catch (err) {
    const failed: Task = { ...running, status: "failed", error: String(err) };
    await updateTask(failed);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
