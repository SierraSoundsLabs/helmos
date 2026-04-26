"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task } from "@/lib/tasks";

// ─── MARKDOWN RENDERER (lightweight) ─────────────────────────────────────────
function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="prose prose-invert prose-sm max-w-none text-zinc-300">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <h2 key={i} className="text-white font-bold text-sm mt-4 mb-1">{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h1 key={i} className="text-white font-bold text-base mt-4 mb-2">{line.slice(2)}</h1>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-white font-semibold text-xs mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="text-zinc-400 text-xs leading-relaxed ml-2 before:content-['•'] before:mr-2 before:text-[#6366f1]">{line.slice(2)}</p>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="text-white font-semibold text-xs mt-2">{line.slice(2, -2)}</p>;
        if (line.trim() === "") return <div key={i} className="h-1" />;
        // Bold inline
        const parts = line.split(/(\*\*[^*]+\*\*)/);
        return (
          <p key={i} className="text-zinc-400 text-xs leading-relaxed">
            {parts.map((p, j) => p.startsWith("**") ? <strong key={j} className="text-zinc-200 font-semibold">{p.slice(2, -2)}</strong> : p)}
          </p>
        );
      })}
    </div>
  );
}

// ─── TASK RESULT MODAL ────────────────────────────────────────────────────────
function ResultModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{task.icon}</span>
            <div>
              <h3 className="text-sm font-semibold text-white">{task.title}</h3>
              <p className="text-xs text-zinc-500">{task.agentName} · Completed</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(task.output ?? ""); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${copied ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1e1e1e] text-zinc-300 hover:bg-[#2a2a2a]"}`}
            >
              {copied ? "Copied ✓" : "Copy all"}
            </button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e1e1e] text-zinc-400 hover:bg-[#2a2a2a] transition-colors">✕</button>
          </div>
        </div>
        <div className="overflow-y-auto p-5 flex-1">
          <Markdown content={task.output ?? ""} />
        </div>
      </div>
    </div>
  );
}

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { label: "Queued",    dot: "bg-zinc-600",    badge: "text-zinc-500 bg-zinc-900",     pulse: false },
  running:   { label: "Working…",  dot: "bg-[#6366f1]",   badge: "text-[#818cf8] bg-[#6366f1]/10", pulse: true  },
  completed: { label: "Done",      dot: "bg-emerald-500", badge: "text-emerald-400 bg-emerald-500/10", pulse: false },
  failed:    { label: "Failed",    dot: "bg-red-500",     badge: "text-red-400 bg-red-500/10",    pulse: false },
};

// ─── TASK CARD ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onView, onRetry }: { task: Task; onView: (t: Task) => void; onRetry: (taskId: string) => void }) {
  const cfg = STATUS_CONFIG[task.status];
  const isRunning = task.status === "running";
  const isDone = task.status === "completed";
  const isStuck = task.status === "pending" || task.status === "failed";
  const [retrying, setRetrying] = useState(false);

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isRunning ? "border-[#6366f1]/40 bg-[#6366f1]/5" :
      isDone    ? "border-[#1e1e1e] bg-[#0f0f0f] hover:border-[#2a2a2a]" :
                  "border-[#181818] bg-[#0b0b0b] opacity-70"
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-lg ${
          isRunning ? "bg-[#6366f1]/15" : isDone ? "bg-[#1a1a1a]" : "bg-[#131313]"
        }`}>
          {task.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-white">{task.title}</span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.badge}`}>
              {cfg.pulse && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />}
              {cfg.label}
            </span>
          </div>
          <p className="text-[11px] text-zinc-600 leading-relaxed">{task.description}</p>

          {isDone && task.output && (
            <div className="mt-2">
              <p className="text-[11px] text-zinc-500 line-clamp-2 mb-1.5 italic">
                {task.output.slice(0, 120).replace(/#+\s*/g, "").replace(/\*/g, "")}…
              </p>
              <button
                onClick={() => onView(task)}
                className="text-[11px] font-medium text-[#6366f1] hover:text-[#818cf8] transition-colors"
              >
                View full results →
              </button>
            </div>
          )}

          {isRunning && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1 h-1 rounded-full bg-[#6366f1]"
                    style={{ animation: `pulse 1.2s ease-in-out ${i*0.3}s infinite` }} />
                ))}
              </div>
              <span className="text-[10px] text-zinc-600">~{task.estimatedMinutes} min remaining</span>
            </div>
          )}

          {isStuck && (
            <button
              onClick={async () => {
                setRetrying(true);
                await onRetry(task.id);
                setRetrying(false);
              }}
              disabled={retrying}
              className="mt-2 text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {retrying ? "Starting…" : "↻ Run now"}
            </button>
          )}

          {task.status === "failed" && task.error && (
            <p className="mt-1 text-[10px] text-red-400/70 truncate">{task.error}</p>
          )}
        </div>

        {/* Agent tag */}
        <div className="shrink-0 hidden sm:block">
          <span className="text-[10px] text-zinc-600">{task.agentName}</span>
        </div>
      </div>
    </div>
  );
}

// ─── QUEUE DASHBOARD ──────────────────────────────────────────────────────────
export default function QueueDashboard({
  artistId,
  artistName,
  artistImage,
  isPaid,
  onUpgrade,
}: {
  artistId: string;
  artistName: string;
  artistImage?: string;
  isPaid: boolean;
  onUpgrade: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeResult, setActiveResult] = useState<Task | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?artist=${artistId}${!isPaid ? "&demo=1" : ""}`);
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [artistId, isPaid]);

  const handleRefresh = useCallback(async () => {
    await fetchTasks();
    // Also kick the agent runner in case tasks are stuck in queue
    fetch("/api/agent/run", { method: "POST" }).catch(() => {});
  }, [fetchTasks]);

  const handleRetry = useCallback(async (taskId: string) => {
    // Optimistically show as running
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "running" as const } : t));
    try {
      const res = await fetch("/api/tasks/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (data.status === "completed") {
        // Task ran inline — refresh immediately to show result
        await fetchTasks();
      } else {
        // Fallback: poll a few times
        setTimeout(fetchTasks, 3000);
        setTimeout(fetchTasks, 8000);
      }
    } catch {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "pending" as const } : t));
    }
  }, [fetchTasks]);

  useEffect(() => {
    fetchTasks();
    // Poll every 30s for live updates
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const completed = tasks.filter(t => t.status === "completed");
  const running = tasks.filter(t => t.status === "running");
  const pending = tasks.filter(t => t.status === "pending");
  const total = tasks.length;
  const progress = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-16 rounded-xl bg-[#111] border border-[#1a1a1a] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      {activeResult && <ResultModal task={activeResult} onClose={() => setActiveResult(null)} />}

      <div className="flex flex-col gap-5">

        {/* Header card */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5">
          <div className="flex items-center gap-4 mb-4">
            {artistImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artistImage} alt={artistName} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/10" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xl shrink-0">🎵</div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-sm font-bold text-white">{artistName}</h2>
                {isPaid
                  ? <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">⚡ Active</span>
                  : <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Preview</span>
                }
              </div>
              <p className="text-xs text-zinc-500">
                {running.length > 0
                  ? `${running[0].agentName} is working now`
                  : completed.length === total && total > 0
                  ? "All projects complete"
                  : `${completed.length} of ${total} projects done`}
              </p>
            </div>
            <button onClick={handleRefresh} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#222]">↻ Refresh</button>
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div>
              <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-zinc-600">{completed.length} completed</span>
                <span className="text-[10px] text-zinc-600">{pending.length} queued</span>
              </div>
            </div>
          )}
        </div>

        {/* Task list */}
        {!isPaid && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs text-amber-300 font-medium mb-1">You&apos;re seeing a preview</p>
            <p className="text-xs text-zinc-500 mb-3">Activate Helm to start your real agent queue. These are example results from real artists in your genre.</p>
            <button
              onClick={onUpgrade}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 transition-opacity"
            >
              Start Free Trial · $29/mo →
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onView={setActiveResult} onRetry={handleRetry} />
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-12 text-zinc-600 text-sm">
              No tasks yet. Complete intake to start your agent queue.
            </div>
          )}
        </div>

        {/* Knowledge base badge */}
        {completed.length >= 2 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
            <span className="text-base">🧠</span>
            <p className="text-xs text-zinc-500">
              <span className="text-zinc-300 font-medium">Shared intelligence active.</span> Your agents are contributing to Helm&apos;s growing knowledge base — every artist makes the next one smarter.
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,80%,100%{opacity:.3;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
    </>
  );
}
