"use client";

import { useEffect, useState, useCallback } from "react";
import type { OpportunityTask, OpportunityType } from "@/lib/types";

const TYPE_CONFIG: Record<OpportunityType, { emoji: string; label: string; color: string }> = {
  festival:      { emoji: "🎪", label: "Festival",   color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  playlist:      { emoji: "🎵", label: "Playlist",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  press:         { emoji: "📰", label: "Press",      color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  tiktok_growth: { emoji: "📱", label: "TikTok",     color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  sync:          { emoji: "💿", label: "Sync",       color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
};

interface Props {
  artistId: string;
  artistName: string;
  genres: string[];
  monthlyListeners: number;
}

export default function OpportunityFeed({ artistId, artistName, genres, monthlyListeners }: Props) {
  const [opportunities, setOpportunities] = useState<OpportunityTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    try {
      const res = await fetch("/api/helm/opportunities?status=new");
      if (!res.ok) return;
      const data = await res.json() as { opportunities: OpportunityTask[] };
      setOpportunities((data.opportunities ?? []).slice(0, 5));
    } catch {
      // silent fail
    }
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      await fetch("/api/helm/opportunities/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId, artistName, genres, monthlyListeners }),
      });
      await fetchOpportunities();
    } catch {
      // silent fail
    } finally {
      setScanning(false);
    }
  }, [artistId, artistName, genres, monthlyListeners, fetchOpportunities]);

  // On mount: load existing, then auto-scan if empty
  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch("/api/helm/opportunities?status=new").catch(() => null);
      if (res?.ok) {
        const data = await res.json() as { opportunities: OpportunityTask[] };
        const existing = (data.opportunities ?? []).slice(0, 5);
        setOpportunities(existing);
        if (existing.length === 0) {
          // Auto-scan on first load
          await runScan();
        }
      }
      setLoading(false);
    })();
  }, [runScan]);

  const handleDismiss = async (id: string) => {
    setDismissingId(id);
    try {
      await fetch(`/api/helm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      setOpportunities(prev => prev.filter(o => o.id !== id));
    } catch {
      // silent fail
    } finally {
      setDismissingId(null);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await fetch(`/api/helm/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: "approved" } : o));
    } catch {
      // silent fail
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Opportunities</h2>
        <button
          onClick={runScan}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#6366f1]/80 hover:bg-[#6366f1] transition-colors disabled:opacity-50"
        >
          {scanning ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scanning…
            </>
          ) : (
            "Find More →"
          )}
        </button>
      </div>

      {(loading && opportunities.length === 0) ? (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 flex items-center justify-center gap-3">
          <span className="inline-block w-4 h-4 border-2 border-zinc-600 border-t-[#6366f1] rounded-full animate-spin" />
          <span className="text-sm text-zinc-500">Scanning for opportunities…</span>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 text-center">
          <p className="text-sm text-zinc-500">Helmos is scanning for opportunities… check back soon</p>
          <button
            onClick={runScan}
            disabled={scanning}
            className="mt-3 px-4 py-1.5 rounded-lg text-xs font-medium text-[#a5b4fc] border border-[#6366f1]/40 hover:bg-[#6366f1]/10 transition-colors disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Scan Now"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {opportunities.map(opp => {
            const conf = TYPE_CONFIG[opp.type] ?? { emoji: "🎯", label: opp.type, color: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30" };
            const isApproved = opp.status === "approved";
            return (
              <div
                key={opp.id}
                className={`bg-[#111] border rounded-xl p-4 transition-colors ${isApproved ? "border-[#6366f1]/40" : "border-[#1e1e1e] hover:border-[#2e2e2e]"}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${conf.color}`}>
                      {conf.emoji} {conf.label}
                    </span>
                    {isApproved && (
                      <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        ✓ Saved
                      </span>
                    )}
                  </div>
                  {opp.deadline && (
                    <span className="text-[10px] text-zinc-500 shrink-0 whitespace-nowrap">⏰ {opp.deadline}</span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-white mb-1">{opp.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">{opp.description}</p>

                <div className="flex items-center gap-2">
                  {opp.actionUrl && (
                    <a
                      href={opp.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-lg text-[11px] font-semibold text-white bg-[#6366f1]/80 hover:bg-[#6366f1] transition-colors"
                    >
                      {opp.type === "festival" ? "Apply →" : "Explore →"}
                    </a>
                  )}
                  {!isApproved && (
                    <button
                      onClick={() => handleApprove(opp.id)}
                      className="px-3 py-1 rounded-lg text-[11px] font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
                    >
                      Save
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(opp.id)}
                    disabled={dismissingId === opp.id}
                    className="px-3 py-1 rounded-lg text-[11px] font-semibold text-zinc-500 border border-zinc-700/50 hover:bg-zinc-800/50 transition-colors disabled:opacity-40 ml-auto"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
