"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LOADING_STEPS = [
  "Scanning your Spotify profile...",
  "Analyzing your career data...",
  "Building your dashboard...",
];

// ── HERO + URL INPUT ─────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!url.trim()) { setError("Please enter a Spotify artist URL"); return; }

    const match = url.trim().match(/spotify\.com\/artist\/([A-Za-z0-9]+)/);
    if (!match) {
      setError("Please enter a valid Spotify artist URL");
      return;
    }
    const artistId = match[1];

    setLoading(true);
    setLoadingStep(0);

    // Cycle through loading steps
    const interval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < LOADING_STEPS.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 500);

    // Navigate after 1.5s
    setTimeout(() => {
      clearInterval(interval);
      router.push(`/dashboard?artist=${artistId}`);
    }, 1500);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#080808" }}>
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12), transparent)"
      }} />

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080808]">
          <div className="flex flex-col items-center gap-6">
            {/* Animated Helm logo */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center"
              style={{ animation: "helmPulse 1s ease-in-out infinite" }}>
              <span className="text-2xl font-bold text-white">H</span>
            </div>
            <p className="text-white font-semibold text-lg transition-all duration-300">
              {LOADING_STEPS[loadingStep]}
            </p>
            <div className="flex gap-1.5 mt-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-[#6366f1]"
                  style={{ animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
              ))}
            </div>
          </div>
          <style>{`
            @keyframes helmPulse { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(99,102,241,0.4)} 50%{transform:scale(1.08);box-shadow:0 0 0 16px rgba(99,102,241,0)} }
            @keyframes bounce { 0%,80%,100%{transform:scale(.8);opacity:.5} 40%{transform:scale(1.2);opacity:1} }
          `}</style>
        </div>
      )}

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
              Open Your Artist Dashboard →
            </button>
          </form>

          {/* Social proof */}
          <p className="text-xs text-zinc-600">
            Free · No account required · Try 3 days free · $49/mo AI Artist Manager
          </p>
        </div>
      </div>
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
