import { kvGet, kvSet, kvLpush, kvLrange, kvLpop, kvAvailable } from "./kv";
import type { OpportunityTask, OpportunityStatus } from "./types";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type TaskType =
  | "artist_analysis"
  | "journalist_research"
  | "playlist_curators"
  | "press_release"
  | "content_calendar"
  | "artist_bio"
  | "sync_pitch";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface Task {
  id: string;
  userId: string;
  artistId: string;
  type: TaskType;
  status: TaskStatus;
  priority: number;
  title: string;
  description: string;
  icon: string;
  agentName: string;
  estimatedMinutes: number;
  input: Record<string, unknown>;
  output: string | null;         // markdown result
  outputJson: unknown | null;    // structured result if any
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface UserProfile {
  userId: string;
  artistId: string;
  artistName: string;
  goals: string[];
  upcomingRelease: boolean;
  releaseDate?: string;
  releaseTitle?: string;
  email?: string;
  genres: string[];
  monthlyListeners: number;
  latestRelease?: string;
  createdAt: string;
}

// ─── TASK DEFINITIONS ─────────────────────────────────────────────────────────

export const TASK_DEFS: Record<TaskType, Omit<Task, "id" | "userId" | "artistId" | "type" | "status" | "priority" | "input" | "output" | "outputJson" | "createdAt" | "startedAt" | "completedAt" | "error">> = {
  artist_analysis: {
    title: "Analyzing your career",
    description: "Deep dive into your Spotify data, release history, and growth trajectory",
    icon: "🎯",
    agentName: "Strategy Agent",
    estimatedMinutes: 5,
  },
  journalist_research: {
    title: "Finding journalists to cover you",
    description: "Identifying 15 music writers who actively cover your genre and would be interested in your music",
    icon: "📰",
    agentName: "Press Agent",
    estimatedMinutes: 10,
  },
  playlist_curators: {
    title: "Building your playlist pitch list",
    description: "Researching 50 playlist curators in your genre with submission contacts",
    icon: "🎵",
    agentName: "Playlist Agent",
    estimatedMinutes: 10,
  },
  press_release: {
    title: "Writing your press release",
    description: "Drafting a professional press release for your latest release, ready to send",
    icon: "📄",
    agentName: "Press Agent",
    estimatedMinutes: 8,
  },
  content_calendar: {
    title: "Building your content calendar",
    description: "30-day social content plan with captions, hashtags, and posting times",
    icon: "📱",
    agentName: "Content Agent",
    estimatedMinutes: 8,
  },
  artist_bio: {
    title: "Rewriting your artist bio",
    description: "Short + long professional bio that works for press kits and streaming profiles",
    icon: "✍️",
    agentName: "Strategy Agent",
    estimatedMinutes: 5,
  },
  sync_pitch: {
    title: "Finding sync licensing opportunities",
    description: "Identifying sync agencies, music supervisors, and licensing opportunities for your genre",
    icon: "🎬",
    agentName: "Sync Agent",
    estimatedMinutes: 10,
  },
};

// ─── GOAL → TASK MAPPING ──────────────────────────────────────────────────────

export const GOAL_TASKS: Record<string, TaskType[]> = {
  press:     ["journalist_research", "press_release"],
  playlists: ["playlist_curators"],
  content:   ["content_calendar"],
  sync:      ["sync_pitch"],
  bio:       ["artist_bio"],
  growth:    ["playlist_curators", "content_calendar"],
};

export function buildTaskList(goals: string[], hasRelease: boolean): TaskType[] {
  const types = new Set<TaskType>(["artist_analysis", "artist_bio"]);
  for (const goal of goals) {
    for (const type of (GOAL_TASKS[goal] ?? [])) types.add(type);
  }
  if (hasRelease) {
    types.add("press_release");
    types.add("journalist_research");
  }
  // Always include analysis first
  const ordered: TaskType[] = ["artist_analysis"];
  for (const t of types) { if (t !== "artist_analysis") ordered.push(t); }
  return ordered;
}

// ─── QUEUE HELPERS ────────────────────────────────────────────────────────────

function taskKey(taskId: string) { return `helm:task:${taskId}`; }
function userTasksKey(userId: string) { return `helm:user:${userId}:tasks`; }
function globalQueueKey() { return `helm:queue:global`; }
function userProfileKey(userId: string) { return `helm:user:${userId}:profile`; }

export async function createTasks(profile: UserProfile, types: TaskType[]): Promise<Task[]> {
  const tasks: Task[] = [];
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const def = TASK_DEFS[type];
    const task: Task = {
      id: `task_${Date.now()}_${i}`,
      userId: profile.userId,
      artistId: profile.artistId,
      type,
      status: "pending",
      priority: i,
      input: {
        artistId: profile.artistId,
        artistName: profile.artistName,
        genres: profile.genres,
        monthlyListeners: profile.monthlyListeners,
        goals: profile.goals,
        latestRelease: profile.latestRelease,
        releaseDate: profile.releaseDate,
        releaseTitle: profile.releaseTitle,
        upcomingRelease: profile.upcomingRelease,
      },
      output: null,
      outputJson: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
      ...def,
    };
    tasks.push(task);
  }

  if (kvAvailable()) {
    // Save each task + add to user's list + global queue
    for (const task of tasks) {
      await kvSet(taskKey(task.id), task, 60 * 60 * 24 * 90); // 90 days
    }
    await kvSet(userTasksKey(profile.userId), tasks.map(t => t.id), 60 * 60 * 24 * 90);
    // Queue for processing (only first task initially — runner picks up next after each completes)
    await kvLpush(globalQueueKey(), { taskId: tasks[0].id, userId: profile.userId });
  }

  return tasks;
}

export async function getUserTasks(userId: string): Promise<Task[]> {
  if (!kvAvailable()) return getMockTasks(userId);
  const taskIds = await kvGet<string[]>(userTasksKey(userId));
  if (!taskIds?.length) return [];
  const tasks = await Promise.all(taskIds.map(id => kvGet<Task>(taskKey(id))));
  return tasks.filter(Boolean).sort((a, b) => (a!.priority) - (b!.priority)) as Task[];
}

export async function getTask(taskId: string): Promise<Task | null> {
  if (!kvAvailable()) return null;
  return kvGet<Task>(taskKey(taskId));
}

export async function updateTask(task: Task): Promise<void> {
  if (!kvAvailable()) return;
  await kvSet(taskKey(task.id), task, 60 * 60 * 24 * 90);
}

export async function popNextGlobalTask(): Promise<{ taskId: string; userId: string } | null> {
  if (!kvAvailable()) return null;
  return kvLpop<{ taskId: string; userId: string }>(globalQueueKey());
}

export async function queueNextTask(userId: string, tasks: Task[]): Promise<void> {
  if (!kvAvailable()) return;
  const nextPending = tasks.find(t => t.status === "pending");
  if (nextPending) {
    await kvLpush(globalQueueKey(), { taskId: nextPending.id, userId });
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (!kvAvailable()) return;
  await kvSet(userProfileKey(profile.userId), profile, 60 * 60 * 24 * 90);
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!kvAvailable()) return null;
  return kvGet<UserProfile>(userProfileKey(userId));
}

// ─── KNOWLEDGE BASE ───────────────────────────────────────────────────────────

export async function getKnowledge(category: string, genre: string): Promise<string> {
  if (!kvAvailable()) return "";
  const key = `helm:knowledge:${category}:${genre.toLowerCase().replace(/\s+/g, "-")}`;
  const data = await kvGet<string>(key);
  return data ?? "";
}

export async function saveKnowledge(category: string, genre: string, content: string): Promise<void> {
  if (!kvAvailable()) return;
  const key = `helm:knowledge:${category}:${genre.toLowerCase().replace(/\s+/g, "-")}`;
  // Merge with existing
  const existing = await kvGet<string>(key) ?? "";
  const merged = existing ? `${existing}\n\n---\n\n${content}` : content;
  await kvSet(key, merged.slice(-8000), 60 * 60 * 24 * 365); // keep 8k chars, 1 year
}

// ─── OPPORTUNITY TASKS ────────────────────────────────────────────────────────

function opportunityKey(id: string) { return `helm:opportunity:${id}`; }
function userOpportunitiesKey(userEmail: string) { return `helm:user:${userEmail}:opportunities`; }

export async function saveOpportunity(opp: OpportunityTask): Promise<void> {
  if (!kvAvailable()) return;
  await kvSet(opportunityKey(opp.id), opp, 60 * 60 * 24 * 90);
  const ids = await kvGet<string[]>(userOpportunitiesKey(opp.userEmail)) ?? [];
  if (!ids.includes(opp.id)) {
    ids.unshift(opp.id);
    await kvSet(userOpportunitiesKey(opp.userEmail), ids, 60 * 60 * 24 * 90);
  }
}

export async function getUserOpportunities(
  userEmail: string,
  status?: OpportunityStatus,
): Promise<OpportunityTask[]> {
  if (!kvAvailable()) return [];
  const ids = await kvGet<string[]>(userOpportunitiesKey(userEmail)) ?? [];
  if (!ids.length) return [];
  const items = await Promise.all(ids.map(id => kvGet<OpportunityTask>(opportunityKey(id))));
  const valid = items.filter(Boolean) as OpportunityTask[];
  if (status) return valid.filter(o => o.status === status);
  return valid;
}

export async function getOpportunity(id: string): Promise<OpportunityTask | null> {
  if (!kvAvailable()) return null;
  return kvGet<OpportunityTask>(opportunityKey(id));
}

export async function updateOpportunity(id: string, patch: Partial<OpportunityTask>): Promise<OpportunityTask | null> {
  if (!kvAvailable()) return null;
  const existing = await kvGet<OpportunityTask>(opportunityKey(id));
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await kvSet(opportunityKey(id), updated, 60 * 60 * 24 * 90);
  return updated;
}

// ─── MOCK DATA (when KV not configured) ───────────────────────────────────────

function getMockTasks(userId: string): Task[] {
  return [
    { id: "mock_1", userId, artistId: "demo", type: "artist_analysis", status: "completed", priority: 0, ...TASK_DEFS.artist_analysis, input: {}, output: "# Career Analysis\n\nYour artist profile shows strong potential in the indie folk space with 12K monthly listeners growing at ~8% month over month. Your top track has a save rate of 22%, well above the 5% industry average — a strong signal for Spotify editorial consideration.\n\n**Key opportunities:**\n1. Spotify editorial playlist submission (save rate qualifies you)\n2. Press coverage in Atwood Magazine and The Line of Best Fit (your sound fits their editorial calendar)\n3. Sync licensing — your acoustic guitar + vocal style is highly in-demand for lifestyle content", outputJson: null, createdAt: new Date(Date.now() - 3600000).toISOString(), startedAt: new Date(Date.now() - 3500000).toISOString(), completedAt: new Date(Date.now() - 3000000).toISOString(), error: null },
    { id: "mock_2", userId, artistId: "demo", type: "journalist_research", status: "completed", priority: 1, ...TASK_DEFS.journalist_research, input: {}, output: "# Journalist Research\n\n## 1. Laura Snapes — The Guardian\n**Contact:** laura.snapes@theguardian.com\n**Recent piece:** 'The indie artists making music for the algorithm-fatigued'\n**Why:** Covers indie/folk artists with authentic storytelling — perfect fit\n\n## 2. Jessica Hopper — Rolling Stone\n**Contact:** pitches@rollingstone.com (attn: Jessica Hopper)\n**Recent piece:** 'How bedroom pop became the sound of gen Z'\n**Why:** Champion of independent artists breaking through without major label support\n\n## 3. Ryan Leas — Stereogum\n**Contact:** tips@stereogum.com\n**Recent piece:** 'The 10 best folk albums of 2025'\n**Why:** Deep indie folk coverage, responsive to email pitches", outputJson: null, createdAt: new Date(Date.now() - 2900000).toISOString(), startedAt: new Date(Date.now() - 2800000).toISOString(), completedAt: new Date(Date.now() - 2200000).toISOString(), error: null },
    { id: "mock_3", userId, artistId: "demo", type: "press_release", status: "running", priority: 2, ...TASK_DEFS.press_release, input: {}, output: null, outputJson: null, createdAt: new Date(Date.now() - 2100000).toISOString(), startedAt: new Date(Date.now() - 300000).toISOString(), completedAt: null, error: null },
    { id: "mock_4", userId, artistId: "demo", type: "playlist_curators", status: "pending", priority: 3, ...TASK_DEFS.playlist_curators, input: {}, output: null, outputJson: null, createdAt: new Date(Date.now() - 2100000).toISOString(), startedAt: null, completedAt: null, error: null },
    { id: "mock_5", userId, artistId: "demo", type: "content_calendar", status: "pending", priority: 4, ...TASK_DEFS.content_calendar, input: {}, output: null, outputJson: null, createdAt: new Date(Date.now() - 2100000).toISOString(), startedAt: null, completedAt: null, error: null },
    { id: "mock_6", userId, artistId: "demo", type: "sync_pitch", status: "pending", priority: 5, ...TASK_DEFS.sync_pitch, input: {}, output: null, outputJson: null, createdAt: new Date(Date.now() - 2100000).toISOString(), startedAt: null, completedAt: null, error: null },
  ];
}
