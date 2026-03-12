"use client";

import { useState, useRef } from "react";
import type { ArtistData } from "@/lib/spotify";
import type { AnalysisResult } from "@/lib/claude";

const STRIPE_URL = "https://buy.stripe.com/eVqaEWchvarC8RA8OB5Vu0B";

const CATEGORY_COLORS: Record<string, string> = {
  Royalties:   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Playlisting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Touring:     "bg-sky-500/20 text-sky-400 border-sky-500/30",
  Social:      "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Press:       "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Strategy:    "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  Release:     "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Sync:        "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Outreach:    "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Merch:       "bg-rose-500/20 text-rose-400 border-rose-500/30",
  Advertising: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  Booking:     "bg-teal-500/20 text-teal-400 border-teal-500/30",
  Labels:      "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const URGENCY_COLORS: Record<string, string> = {
  "Tonight":    "bg-red-500/20 text-red-400 border-red-500/30",
  "This week":  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "This month": "bg-zinc-700/60 text-zinc-400 border-zinc-600/30",
};

const STAGE_CONFIG = {
  Emerging:    { color: "text-zinc-400",    bar: "#71717a", pct: 20 },
  Growing:     { color: "text-blue-400",    bar: "#3b82f6", pct: 45 },
  Established: { color: "text-emerald-400", bar: "#10b981", pct: 70 },
  Breakthrough:{ color: "text-yellow-400",  bar: "#f59e0b", pct: 90 },
};

function Sparkline({ popularity }: { popularity: number }) {
  const base = Math.max(10, popularity - 30);
  const pts = [base, base+5, base-3, base+8, base+2, base+12, base+6, popularity];
  const max = Math.max(...pts), min = Math.min(...pts), range = max-min||1;
  const w=120, h=40, pad=4;
  const xs = pts.map((_,i)=>pad+(i/(pts.length-1))*(w-pad*2));
  const ys = pts.map(v=>h-pad-((v-min)/range)*(h-pad*2));
  const d = xs.map((x,i)=>`${i===0?"M":"L"}${x},${ys[i]}`).join(" ");
  const area = `${d} L${xs[xs.length-1]},${h} L${xs[0]},${h} Z`;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3"/>
        <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
      </linearGradient></defs>
      <path d={area} fill="url(#sg)"/>
      <path d={d} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="3" fill="#6366f1"/>
    </svg>
  );
}

// ── DASHBOARD VIEW (shown inline after URL submit) ──────────────────────────
function DashboardView({ artist, analysis }: { artist: ArtistData; analysis: AnalysisResult }) {
  const stage = analysis.careerStage || "Emerging";
  const stageConf = STAGE_CONFIG[stage] || STAGE_CONFIG.Emerging;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-8 pb-24 flex flex-col gap-8">

      {/* Artist header */}
      <div className="flex items-center gap-4">
        {artist.image && (
          <img src={artist.image} alt={artist.name} className="w-16 h-16 rounded-full object-cover border border-[#2e2e2e] shrink-0" />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{artist.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {artist.genres.slice(0, 3).map(g => (
              <span key={g} className="text-[11px] text-zinc-400 bg-[#1a1a1a] border border-[#2e2e2e] px-2 py-0.5 rounded-full capitalize">{g}</span>
            ))}
          </div>
        </div>
        <a href={artist.spotifyUrl} target="_blank" rel="noopener noreferrer"
          className="ml-auto shrink-0 flex items-center gap-2 px-3 py-1.5 bg-[#1DB954]/10 border border-[#1DB954]/30 rounded-lg text-[11px] font-semibold text-[#1DB954] hover:bg-[#1DB954]/20 transition-colors">
          <SpotifyIcon /> Spotify
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Followers", value: artist.monthlyListeners, note: "Spotify" },
          { label: "Popularity", value: `${artist.spotifyPopularity}/100`, note: "Spotify score" },
          { label: "Top Song", value: artist.topSong?.name ? artist.topSong.name.slice(0, 14) + (artist.topSong.name.length > 14 ? "…" : "") : "—", note: artist.topSong ? `${artist.topSong.popularity}/100 popularity` : "" },
          { label: "Releases", value: String(artist.allReleases.length), note: "on Spotify" },
        ].map(s => (
          <div key={s.label} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{s.note}</p>
          </div>
        ))}
      </div>

      {/* Big win */}
      {analysis.bigWin && (
        <div className="flex items-center gap-3 bg-[#0d1400] border border-yellow-500/30 rounded-xl p-4">
          <span className="text-2xl">🏆</span>
          <div>
            <p className="text-[11px] text-yellow-400 font-bold uppercase tracking-wider mb-0.5">Big Win</p>
            <p className="text-sm text-zinc-200">{analysis.bigWin}</p>
          </div>
        </div>
      )}

      {/* Narrative */}
      <div className="bg-[#0d0d1a] border border-[#6366f1]/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-white">H</span>
          </div>
          <span className="text-xs font-semibold text-zinc-300">Helm Agent · {analysis.agentStatus}</span>
          <span className="ml-auto text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">READY</span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed mb-4">{analysis.narrative}</p>
        <div className="flex flex-col gap-1.5 mb-4">
          {analysis.completedItems.map((item, i) => (
            <div key={i} className="flex gap-2 text-xs text-zinc-400">
              <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-white mb-2">Top opportunity:</p>
        <p className="text-sm text-[#a5b4fc] font-medium">{analysis.topOpportunity}</p>
      </div>

      {/* Two-column: tasks + right panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

        {/* Left: tasks */}
        <div className="flex flex-col gap-6">

          {/* Career stage */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Career Stage</p>
                <p className={`text-2xl font-bold ${stageConf.color}`}>{stage}</p>
              </div>
              <Sparkline popularity={artist.spotifyPopularity} />
            </div>
            <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${stageConf.pct}%`, background: stageConf.bar }} />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1.5">
              <span>Emerging</span><span>Growing</span><span>Established</span><span>Breakthrough</span>
            </div>
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">What Helm Does For You</h2>
              <span className="text-xs text-zinc-500">{analysis.tasks.length} tasks queued</span>
            </div>
            <div className="flex flex-col gap-3">
              {analysis.tasks.map((task, i) => (
                <div key={i} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 hover:border-[#2e2e2e] transition-colors">
                  <h3 className="text-sm font-semibold text-white mb-2">{task.title}</h3>
                  <ul className="flex flex-col gap-1.5 mb-3">
                    {task.bullets.map((b, j) => (
                      <li key={j} className="text-xs text-zinc-400 flex gap-2">
                        <span className="text-zinc-600 shrink-0">–</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${CATEGORY_COLORS[task.category] || "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"}`}>
                        {task.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${URGENCY_COLORS[task.urgency] || ""}`}>
                        {task.urgency}
                      </span>
                    </div>
                    {task.actionButton && (
                      <a href={STRIPE_URL} className="px-3 py-1 rounded-lg text-[11px] font-semibold text-white bg-[#6366f1]/80 hover:bg-[#6366f1] transition-colors shrink-0">
                        {task.actionButton} →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Social content offer */}
          <div className="bg-[#110d1a] border border-pink-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📱</span>
              <h2 className="text-sm font-semibold text-white">TikTok & Instagram Content</h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">{analysis.socialContent.contentOffer}</p>
            <div className="flex gap-2 flex-wrap">
              <a href={STRIPE_URL} className="px-3 py-1.5 text-xs font-semibold text-white bg-pink-500/20 border border-pink-500/30 rounded-lg hover:bg-pink-500/30 transition-colors">
                Start Content Calendar →
              </a>
            </div>
          </div>

          {/* While you sleep */}
          <div className="bg-[#0a0a12] border border-[#6366f1]/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🌙</span>
              <h2 className="text-sm font-semibold text-white">While You Sleep, Helm Is Working</h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {(analysis.whileYouSleep || []).map((item, i) => (
                <div key={i} className="flex gap-2.5 text-xs text-zinc-400">
                  <span className="text-[#6366f1] shrink-0 font-mono">→</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div>
            <h2 className="text-sm font-semibold text-white mb-3">Documents Ready to Build</h2>
            <div className="flex flex-col gap-2">
              {analysis.documents.map((doc, i) => (
                <a key={i} href={STRIPE_URL} className="flex items-center gap-3 p-3 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#2e2e2e] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] flex items-center justify-center shrink-0">
                    <span className="text-sm">📄</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{doc.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{doc.description}</p>
                  </div>
                  <span className="text-[10px] text-[#6366f1] shrink-0">Generate →</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Right: subscribe panel */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 self-start">
          <div className="bg-[#111] border border-[#6366f1]/30 rounded-xl overflow-hidden">
            <div className="p-5 flex flex-col gap-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Activate Helm for {artist.name}</p>
                <p className="text-2xl font-bold text-white">$49<span className="text-base font-normal text-zinc-400">/mo</span></p>
              </div>
              <ul className="flex flex-col gap-2">
                {[
                  "All 5 tasks executed automatically",
                  "Social content created + scheduled",
                  "Royalty audit across all PROs",
                  "Touring pipeline built & maintained",
                  "Press pitches sent on your behalf",
                  "Cancel anytime",
                ].map((f, i) => (
                  <li key={i} className="flex gap-2 text-xs text-zinc-300">
                    <span className="text-emerald-400 shrink-0">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a href={STRIPE_URL}
                className="w-full text-center px-4 py-3.5 rounded-xl text-sm font-bold text-white block hover:scale-[1.02] transition-transform"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                Subscribe &amp; Activate Helm →
              </a>
              <p className="text-[10px] text-zinc-600 text-center -mt-2">Cancel anytime · No setup fee</p>
            </div>
          </div>

          {/* Task list for panel */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
            <p className="text-[11px] text-zinc-500 mb-3">Helm will execute:</p>
            <div className="flex flex-col gap-2">
              {analysis.tasks.map((task, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="text-zinc-600 shrink-0 font-mono mt-0.5">{i+1}.</span>
                  <span className="text-zinc-300">{task.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="border border-[#6366f1]/20 rounded-2xl p-8 text-center bg-gradient-to-b from-[#0d0d1a] to-[#080808] flex flex-col items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
          <span className="text-xl font-bold text-white">H</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">You make the music.</h2>
          <p className="text-zinc-400">Helm runs {artist.name}&apos;s business — starting tonight.</p>
        </div>
        <a href={STRIPE_URL}
          className="px-8 py-4 rounded-xl text-base font-bold text-white hover:scale-[1.02] transition-transform"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          Subscribe · $49/month →
        </a>
        <p className="text-sm text-zinc-600">Cancel anytime · No contracts · No setup fees</p>
      </div>
    </div>
  );
}

// ── HERO + URL INPUT ─────────────────────────────────────────────────────────
export default function Home() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!url.trim()) { setError("Please enter a Spotify artist URL"); return; }

    setLoading(true);
    setLoadingStep("Fetching Spotify data...");

    try {
      // Step 1: fetch artist data
      const res = await fetch(`/api/artist?spotifyUrl=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to fetch artist data"); setLoading(false); return; }

      setArtist(data);
      setLoadingStep("Analyzing with Helm...");

      // Step 2: run Claude analysis (POST with full artist data)
      const analysisRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const analysisData = await analysisRes.json();
      if (!analysisRes.ok) { setError(analysisData.error || "Analysis failed"); setLoading(false); return; }

      setAnalysis(analysisData);
      setLoading(false);

      // Scroll to dashboard
      setTimeout(() => dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#080808" }}>
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12), transparent)"
      }} />

      {/* ── HERO SECTION ── */}
      <div className="relative flex flex-col items-center justify-center px-4 py-20 min-h-screen">
        <div className="w-full max-w-xl flex flex-col items-center text-center gap-8">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-sm font-bold text-white">H</span>
            </div>
            <span className="text-lg font-semibold text-white tracking-tight">Helm</span>
          </div>

          {/* Hero */}
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
              You make the music.{" "}
              <span className="bg-gradient-to-r from-[#6366f1] to-[#a78bfa] bg-clip-text text-transparent">
                Helm runs the business.
              </span>
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed max-w-md mx-auto">
              Paste your Spotify link. Get a personalized career plan and see exactly what Helm
              executes for you — starting tonight.
            </p>
          </div>

          {/* Value grid */}
          <div className="grid grid-cols-3 gap-3 w-full text-left">
            {[
              { icon: "🎯", title: "Finds the gaps", desc: "Royalties you're missing, shows you're not on, press you haven't gotten" },
              { icon: "⚡", title: "Executes overnight", desc: "Pitches sent, campaigns running, contacts researched while you sleep" },
              { icon: "📈", title: "Scales with you", desc: "From 1K to 1M listeners — the right moves at every stage" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-1.5 p-3 rounded-xl border bg-[#111] border-[#1e1e1e]">
                <span className="text-xl">{icon}</span>
                <span className="text-xs font-semibold text-white">{title}</span>
                <span className="text-[11px] text-zinc-500 leading-snug">{desc}</span>
              </div>
            ))}
          </div>

          {/* URL input */}
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            <div className="relative flex items-center gap-2 bg-[#111] border border-[#2e2e2e] rounded-xl px-4 py-3 focus-within:border-[#6366f1]/60 transition-colors">
              <SpotifyIcon />
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="open.spotify.com/artist/..."
                className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
              />
            </div>
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner />
                  {loadingStep}
                </span>
              ) : "See Your Helm Report →"}
            </button>
          </form>

          {/* Social proof */}
          <p className="text-xs text-zinc-600">
            Free career report · No account required · $49/mo to activate
          </p>
        </div>
      </div>

      {/* ── DASHBOARD (rendered inline after submit) ── */}
      {artist && analysis && (
        <div ref={dashboardRef} className="border-t border-[#1e1e1e]">
          <DashboardView artist={artist} analysis={analysis} />
        </div>
      )}
    </div>
  );
}

// ── ICONS ────────────────────────────────────────────────────────────────────
function SpotifyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#1DB954] shrink-0">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
