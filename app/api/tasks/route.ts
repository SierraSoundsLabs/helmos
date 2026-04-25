import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserTasks, createTasks, saveUserProfile, getUserProfile } from "@/lib/tasks";
import type { TaskType } from "@/lib/tasks";

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid && !req.nextUrl.searchParams.get("demo")) {
    return NextResponse.json({ error: "Not subscribed" }, { status: 403 });
  }

  const artistId = req.nextUrl.searchParams.get("artist") ?? session?.artistId;
  if (!artistId) return NextResponse.json({ tasks: [] });

  const userId = artistId; // for now, userId = artistId
  const tasks = await getUserTasks(userId);
  return NextResponse.json({ tasks });
}

// Map doc type -> task type
const DOC_TO_TASK: Record<string, TaskType> = {
  "bio": "artist_bio",
  "one-sheet": "artist_bio",  // one-sheet uses bio task as its queue entry
  "press-release": "press_release",
  "pitch-email": "playlist_curators",
};

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) {
    return NextResponse.json({ error: "Not subscribed" }, { status: 403 });
  }

  const body = await req.json();
  const { artistId, artistName, docType } = body as { artistId: string; artistName: string; docType: string };
  if (!artistId || !docType) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const taskType = DOC_TO_TASK[docType];
  if (!taskType) return NextResponse.json({ error: "Unknown doc type" }, { status: 400 });

  const userId = artistId;

  // Get or build a minimal user profile
  let profile = await getUserProfile(userId);
  if (!profile) {
    profile = {
      userId,
      artistId,
      artistName: artistName ?? "Unknown Artist",
      goals: [],
      upcomingRelease: false,
      genres: [],
      monthlyListeners: 0,
      createdAt: new Date().toISOString(),
    };
    await saveUserProfile(profile);
  }

  // Check if a task of this type already exists and is not failed
  const existing = await getUserTasks(userId);
  const alreadyExists = existing.some(t => t.type === taskType && t.status !== "failed");
  if (alreadyExists) {
    return NextResponse.json({ skipped: true, reason: "Task already exists" });
  }

  const tasks = await createTasks(profile, [taskType]);

  // Fire agent runner immediately — don't wait for 30-min cron
  const baseUrl = req.nextUrl.origin;
  const cronSecret = process.env.CRON_SECRET ?? "";
  fetch(`${baseUrl}/api/agent/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
    },
  }).catch(() => {});

  return NextResponse.json({ created: tasks.length, tasks });
}
