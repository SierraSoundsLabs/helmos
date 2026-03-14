"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const GOALS = [
  { id: "press",     icon: "📰", label: "Press coverage", desc: "Get written up in blogs and magazines" },
  { id: "playlists", icon: "🎵", label: "Playlist placements", desc: "Land on Spotify and editorial playlists" },
  { id: "content",   icon: "📱", label: "Content strategy", desc: "Build a consistent social presence" },
  { id: "sync",      icon: "🎬", label: "Sync licensing", desc: "Get your music in film, TV, and ads" },
  { id: "bio",       icon: "✍️", label: "Artist bio + press kit", desc: "Professional materials for pitching" },
  { id: "growth",    icon: "📈", label: "Fan growth", desc: "Grow followers and monthly listeners" },
];

function IntakeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const artistId = searchParams.get("artist") ?? "";

  const [goals, setGoals] = useState<string[]>([]);
  const [hasRelease, setHasRelease] = useState<boolean | null>(null);
  const [releaseDate, setReleaseDate] = useState("");
  const [releaseTitle, setReleaseTitle] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleGoal(id: string) {
    setGoals(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id]);
  }

  async function handleSubmit() {
    if (goals.length === 0) { setError("Pick at least one goal."); return; }
    if (hasRelease === null) { setError("Let us know about upcoming releases."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId, goals, hasRelease, releaseDate, releaseTitle, email }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/dashboard?artist=${artistId}&mode=queue`);
      } else {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white px-4 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl font-bold">H</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Let&apos;s get to work</h1>
          <p className="text-zinc-400 text-lg">Tell Helm what matters most. Your agents start immediately.</p>
        </div>

        {/* Goals */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">What should Helm focus on?</h2>
          <div className="grid grid-cols-2 gap-3">
            {GOALS.map(g => (
              <button
                key={g.id}
                onClick={() => toggleGoal(g.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  goals.includes(g.id)
                    ? "border-[#6366f1] bg-[#6366f1]/10"
                    : "border-[#1e1e1e] bg-[#111] hover:border-zinc-600"
                }`}
              >
                <div className="text-xl mb-1">{g.icon}</div>
                <div className="font-medium text-sm">{g.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{g.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Upcoming release */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Got a release coming up?</h2>
          <div className="flex gap-3 mb-4">
            {[{ val: true, label: "Yes, I have music dropping" }, { val: false, label: "No upcoming release" }].map(opt => (
              <button
                key={String(opt.val)}
                onClick={() => setHasRelease(opt.val)}
                className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                  hasRelease === opt.val
                    ? "border-[#6366f1] bg-[#6366f1]/10 text-white"
                    : "border-[#1e1e1e] bg-[#111] text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {hasRelease && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Release title</label>
                <input
                  value={releaseTitle}
                  onChange={e => setReleaseTitle(e.target.value)}
                  placeholder="Song or album name"
                  className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#6366f1]"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1.5">Release date</label>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={e => setReleaseDate(e.target.value)}
                  className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#6366f1] [color-scheme:dark]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Where should we send results?</h2>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#6366f1]"
          />
          <p className="text-xs text-zinc-600 mt-1.5">We&apos;ll email you when each agent completes their work.</p>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {loading ? "Launching your team…" : "Start Helm ⚡"}
        </button>

        <p className="text-center text-xs text-zinc-600 mt-4">
          Your agents start working immediately. Results delivered within 24 hours.
        </p>
      </div>
    </div>
  );
}

export default function IntakePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] animate-pulse" />
      </div>
    }>
      <IntakeContent />
    </Suspense>
  );
}
