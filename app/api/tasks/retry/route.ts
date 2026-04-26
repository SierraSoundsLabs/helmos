import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTask, updateTask } from "@/lib/tasks";
import { kvLpush } from "@/lib/kv";
import type { Task } from "@/lib/tasks";

// Re-queues a stuck/failed task and fires the agent runner immediately
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await req.json() as { taskId: string };
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const task = await getTask(taskId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Reset task to pending
  const reset: Task = {
    ...task,
    status: "pending",
    startedAt: null,
    completedAt: null,
    error: null,
  };
  await updateTask(reset);

  // Re-add to front of global queue
  await kvLpush("helm:queue:global", { taskId, userId: task.userId });

  // Fire agent runner immediately
  const baseUrl = req.nextUrl.origin;
  const cronSecret = process.env.CRON_SECRET ?? "";
  fetch(`${baseUrl}/api/agent/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, taskId });
}
