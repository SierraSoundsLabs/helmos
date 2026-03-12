"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

// ── WORKS & RECORDINGS TAB ──────────────────────────────────────────────────
function WorksTab({ artist }: { artist: ArtistData }) {
  const releases = artist.allReleases || [];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-white">Works & Recordings</h2>
          <p className="text-sm text-zinc-500 mt-1">{releases.length} releases found on Spotify</p>
        </div>
        <div className="flex gap-2">
          <a href={STRIPE_URL} className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] transition-colors">
            📋 Capture Song Splits
          </a>
          <a href={STRIPE_URL} className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-300 bg-[#1e1e1e] hover:bg-[#2e2e2e] transition-colors">
            🔍 Run Royalty Audit
          </a>
        </div>
      </div>

      {/* Royalty audit callout */}
      <div className="bg-[#0d1a12] border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl mt-0.5">💰</span>
        <div>
          <p className="text-sm font-semibold text-emerald-400 mb-1">Royalty Audit Available</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Helm will compare your top {Math.min(10, releases.length)} recordings against ASCAP/BMI,
            the MLC, and SoundExchange to find unregistered works. Any gaps found = Helm enrolls them
            through <strong className="text-white">Good Morning Publishing Admin + Distribution</strong> with your approval.
          </p>
          <a href={STRIPE_URL} className="inline-block mt-2 text-xs text-emerald-400 font-semibold hover:text-emerald-300 transition-colors">
            Start audit →
          </a>
        </div>
      </div>

      {/* Release list */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2 border-b border-[#1e1e1e] text-[10px] text-zinc-500 uppercase tracking-wider">
          <span></span>
          <span>Title</span>
          <span>Type</span>
          <span>Released</span>
          <span>Tracks</span>
        </div>
        <div className="divide-y divide-[#1a1a1a]">
          {releases.map((r, i) => (
            <div key={r.id || i} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 hover:bg-[#141414] transition-colors">
              {r.albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.albumArt} alt={r.name} className="w-9 h-9 rounded-md object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-md bg-[#1a1a1a] flex items-center justify-center text-sm">💿</div>
              )}
              <div className="min-w-0">
                <a href={r.spotifyUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:text-[#a5b4fc] transition-colors truncate block">
                  {r.name}
                </a>
              </div>
              <span className="text-[10px] capitalize text-zinc-500 bg-[#1e1e1e] px-2 py-0.5 rounded">{r.type}</span>
              <span className="text-xs text-zinc-500">{r.releaseDate}</span>
              <span className="text-xs text-zinc-500 text-right">{r.totalTracks}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Song splits CTA */}
      <div className="bg-[#0d0d1a] border border-[#6366f1]/30 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-2">Song Splits</h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          Helm can walk you through recording ownership splits for all {releases.length} releases —
          who owns what percentage of publishing and master rights. This data powers royalty collection,
          sync licensing, and label deals.
        </p>
        <a href={STRIPE_URL} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] transition-colors">
          Start Song Splits Walkthrough →
        </a>
      </div>
    </div>
  );
}

// ── RELEASE MARKETING TAB ───────────────────────────────────────────────────
function ReleaseMarketingTab({ artist }: { artist: ArtistData }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-white">Release Marketing</h2>
        <p className="text-sm text-zinc-500 mt-1">Full-service campaign management for your next drop</p>
      </div>

      {/* What Helm does for a release */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { icon: "🔗", title: "Pre-Save Campaign", desc: "Create a pre-save link and run fan engagement before release day", status: "Available" },
          { icon: "📣", title: "Press & Playlist Outreach", desc: "Pitch 10 journalists and 50 playlist curators in your genre 4 weeks out", status: "Available" },
          { icon: "📄", title: "Press Release", desc: "Draft and distribute a press release to genre-specific music blogs", status: "Available" },
          { icon: "📱", title: "Social Content Plan", desc: "30-day content calendar built around your release date and story", status: "Available" },
          { icon: "📣", title: "Fan Acquisition Ads", desc: "Run Meta/Instagram ads to grow your audience before release", status: "Available" },
          { icon: "🎤", title: "Editorial Playlist Pitch", desc: `Submit to Spotify editorial for ${artist.name}'s next release`, status: (artist.monthsAgoLastRelease ?? 99) > 3 ? "Available" : "Needs upcoming release" },
          { icon: "📺", title: "YouTube Premiere", desc: "Set up a YouTube premiere + community post strategy", status: "Available" },
          { icon: "🎙️", title: "Podcast Pitch", desc: "Find 10 music podcasts in your genre and pitch a story", status: "Available" },
        ].map((item) => (
          <a key={item.title} href={STRIPE_URL} className="flex items-start gap-3 p-4 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#2e2e2e] transition-colors">
            <span className="text-xl shrink-0">{item.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  item.status === "Available" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                }`}>{item.status}</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
            </div>
          </a>
        ))}
      </div>

      {/* Editorial timing note */}
      <div className="bg-[#1a1500] border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-amber-400 mb-1">Editorial Playlist Timing</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Helm will only pitch Spotify editorial if you have an upcoming release at least <strong className="text-white">4 weeks out</strong>.
            Pitching too late (or after release) wastes your shot. Plan your campaigns early.
          </p>
        </div>
      </div>

      {/* New Release Agent */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">New Release Agent</h3>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-[#1e1e1e] px-2 py-0.5 rounded">Coming Soon</span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed mb-3">
          Tell Helm about your next release and it builds the entire campaign — timeline, assets,
          pitches, and submissions. All executed automatically from a single conversation.
        </p>
        <div className="flex flex-col gap-1.5">
          {["Set release date + strategy", "Create pre-save + social assets", "Pitch editorial 4 weeks out", "Send press release to 10 blogs", "Run fan acquisition ads", "Submit to playlists on release day"].map(item => (
            <div key={item} className="flex gap-2 text-xs text-zinc-500">
              <span className="text-zinc-700 shrink-0">–</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ artistData, analysis }: { artistData: ArtistData; analysis: AnalysisResult }) {
  const [chatInput, setChatInput] = useState("");
  const stage = analysis.careerStage || "Emerging";
  const stageConf = STAGE_CONFIG[stage] || STAGE_CONFIG.Emerging;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* Main content */}
      <div className="flex flex-col gap-6">
        {/* Career Stage */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Career Stage</p>
              <p className={`text-2xl font-bold ${stageConf.color}`}>{stage}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 mb-1">Momentum</p>
              <Sparkline popularity={artistData.spotifyPopularity} />
            </div>
          </div>
          <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${stageConf.pct}%`, background: stageConf.bar }} />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1.5">
            <span>Emerging</span><span>Growing</span><span>Established</span><span>Breakthrough</span>
          </div>
        </div>

        {/* Tasks */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Tasks</h2>
            <span className="text-xs text-zinc-500">{analysis.tasks.length} queued by Helm</span>
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
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${URGENCY_COLORS[task.urgency] || "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"}`}>
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

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "📣 Run Fan Ads",           desc: "Launch fan acquisition campaign" },
              { label: "📄 Create One-Sheet",       desc: "Artist media kit from Spotify data" },
              { label: "🔗 Pre-Save Link",          desc: "For upcoming release" },
              { label: "🛍️ Launch Merch Store",     desc: "Custom designs + fulfillment" },
              { label: "🎸 Find Open For Slots",    desc: "Submit for touring openers" },
              { label: "🔍 Royalty Audit",          desc: "Compare recordings vs PRO registrations" },
            ].map((action) => (
              <a key={action.label} href={STRIPE_URL}
                className="flex flex-col gap-1 p-3 rounded-xl border bg-[#111] border-[#1e1e1e] hover:border-[#6366f1]/40 hover:bg-[#12121a] transition-all">
                <span className="text-xs font-semibold text-white">{action.label}</span>
                <span className="text-[10px] text-zinc-500 leading-tight">{action.desc}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Documents */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Documents</h2>
          </div>
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
            <a href={STRIPE_URL} className="flex items-center gap-3 p-3 bg-[#111] border border-[#6366f1]/30 rounded-xl hover:border-[#6366f1]/60 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-[#6366f1]/20 border border-[#6366f1]/30 flex items-center justify-center shrink-0">
                <span className="text-sm">🔍</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Artist Research Report</p>
                <p className="text-xs text-zinc-500">Deep dive across Spotify, Instagram, TikTok, and press</p>
              </div>
              <span className="text-[10px] text-[#6366f1] shrink-0">Build →</span>
            </a>
          </div>
        </div>
      </div>

      {/* Right: Helm Agent panel */}
      <div className="flex flex-col gap-4">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-[#1e1e1e]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">H</span>
              </div>
              <span className="text-xs font-semibold text-white">Helm Agent</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">READY</span>
          </div>

          <div className="p-4 flex flex-col gap-5">
            <div>
              <p className="text-[11px] text-zinc-500 mb-2.5">I&apos;ve analyzed {artistData.name}:</p>
              <div className="flex flex-col gap-2">
                {analysis.completedItems.map((item, i) => (
                  <div key={i} className="flex gap-2 text-xs text-zinc-300">
                    <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] text-zinc-500 mb-2.5">Here&apos;s what I&apos;ll execute:</p>
              <div className="flex flex-col gap-2">
                {analysis.tasks.map((task, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-zinc-600 shrink-0 font-mono mt-0.5">{i+1}.</span>
                    <span className="text-white font-medium">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0d0d0d] rounded-xl p-3.5 border border-[#1e1e1e]">
              <p className="text-xs text-zinc-400 leading-relaxed">{analysis.narrative}</p>
            </div>

            <a href={STRIPE_URL} className="w-full text-center px-4 py-3 rounded-xl text-sm font-semibold text-white block hover:scale-[1.02] transition-transform"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              Subscribe to activate →
            </a>
            <p className="text-[10px] text-zinc-600 text-center -mt-3">$49/mo · Cancel anytime</p>

            <a href={STRIPE_URL} className="flex items-center gap-3 p-3.5 bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl hover:border-[#6366f1]/40 transition-colors">
              <span className="text-xl">📣</span>
              <div>
                <p className="text-xs font-semibold text-white">Run Fan Acquisition Ads</p>
                <p className="text-[10px] text-zinc-500">Target new listeners on Meta · Set your budget</p>
              </div>
            </a>
          </div>

          {/* Ask Helm */}
          <div className="border-t border-[#1e1e1e] p-3">
            <p className="text-[10px] text-zinc-600 mb-2">Ask Helm anything</p>
            <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-2 focus-within:border-[#6366f1]/50 transition-colors">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") window.location.href = STRIPE_URL; }}
                placeholder={`How do I grow ${artistData.name}'s fanbase?`}
                className="flex-1 bg-transparent text-xs text-white placeholder-zinc-600 outline-none"
              />
              <button onClick={() => window.location.href = STRIPE_URL} className="text-[#6366f1] hover:text-[#818cf8] transition-colors font-bold">↑</button>
            </div>
            <p className="text-[10px] text-zinc-700 mt-1.5 text-center">Subscribe to unlock Helm chat</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const artistId = searchParams.get("artist");

  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [phase, setPhase] = useState<"loading-artist" | "loading-analysis" | "done" | "error">("loading-artist");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "works" | "release">("overview");

  const loadDashboard = useCallback(async () => {
    if (!artistId) { router.push("/"); return; }
    try {
      setPhase("loading-artist");
      const artistRes = await fetch(`/api/artist?spotifyUrl=spotify:artist:${artistId}`);
      const artist = await artistRes.json();
      if (!artistRes.ok) { setErrorMsg(artist.error || "Failed to load artist"); setPhase("error"); return; }
      setArtistData(artist);
      setPhase("loading-analysis");
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(artist),
      });
      const analysisData = await analyzeRes.json();
      if (!analyzeRes.ok) { setErrorMsg(analysisData.error || "Failed to analyze artist"); setPhase("error"); return; }
      setAnalysis(analysisData);
      setPhase("done");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setPhase("error");
    }
  }, [artistId, router]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (phase === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-[#0a0a0a]">
        <div className="text-center flex flex-col gap-3">
          <p className="text-4xl">😕</p>
          <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
          <p className="text-zinc-400 text-sm">{errorMsg}</p>
        </div>
        <button onClick={() => router.push("/")} className="px-6 py-3 rounded-xl text-sm font-medium text-white bg-[#6366f1]">
          Try another artist
        </button>
      </div>
    );
  }

  if (phase !== "done" || !artistData || !analysis) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center animate-pulse">
            <span className="text-xl font-bold text-white">H</span>
          </div>
          <p className="text-white font-medium">
            {phase === "loading-artist" ? "Scanning Spotify & Last.fm..." : "Building your career plan..."}
          </p>
          <p className="text-zinc-500 text-sm">
            {phase === "loading-analysis" ? "Helm is analyzing your career data" : "Fetching artist profile"}
          </p>
          <div className="flex gap-1.5 mt-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"
                style={{ animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(.8);opacity:.5} 40%{transform:scale(1.2);opacity:1} }`}</style>
      </div>
    );
  }

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "works",    label: `Works & Recordings (${artistData.allReleases.length})` },
    { id: "release",  label: "Release Marketing" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1a1a1a] px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-xs font-bold text-white">H</span>
            </div>
            <span className="text-sm font-semibold text-white">Helm</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-zinc-500 max-w-[240px] truncate">{analysis.topOpportunity}</span>
            <a href={STRIPE_URL} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] transition-colors">
              Start Free Trial · $49/mo
            </a>
          </div>
        </div>
      </nav>

      {/* Artist header + tabs */}
      <div className="border-b border-[#1a1a1a] px-6">
        <div className="max-w-7xl mx-auto">
          {/* Artist summary bar */}
          <div className="flex items-center gap-4 py-4">
            {artistData.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artistData.image} alt={artistData.name} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/10 shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center shrink-0 text-xl">🎵</div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white">{artistData.name}</h1>
              <div className="flex items-center gap-3 flex-wrap mt-0.5">
                {artistData.genres.slice(0,3).map(g => (
                  <span key={g} className="text-[11px] text-zinc-500">{g}</span>
                ))}
                <span className="text-[11px] text-zinc-600">·</span>
                <span className="text-[11px] text-zinc-500">{artistData.monthlyListeners} listeners</span>
                <span className="text-[11px] text-zinc-600">·</span>
                <span className="text-[11px] text-zinc-500">Spotify {artistData.spotifyPopularity}/100</span>
              </div>
            </div>
            {artistData.topSong && (
              <div className="hidden sm:flex items-center gap-2 ml-auto shrink-0 bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2">
                {artistData.topSong.albumArt && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artistData.topSong.albumArt} alt="" className="w-7 h-7 rounded object-cover" />
                )}
                <div>
                  <p className="text-xs font-medium text-white">{artistData.topSong.name}</p>
                  <p className="text-[10px] text-zinc-500">~{artistData.topSong.streamEstimate} streams</p>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? "text-white bg-[#111] border-t border-l border-r border-[#1e1e1e] -mb-px"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "overview" && <OverviewTab artistData={artistData} analysis={analysis} />}
        {activeTab === "works"    && <WorksTab artist={artistData} />}
        {activeTab === "release"  && <ReleaseMarketingTab artist={artistData} />}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center animate-pulse">
          <span className="text-lg font-bold text-white">H</span>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
