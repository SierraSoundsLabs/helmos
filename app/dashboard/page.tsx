"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ArtistCard from "@/components/ArtistCard";
import TrackList from "@/components/TrackList";
import ActionItems from "@/components/ActionItems";
import CareerScore from "@/components/CareerScore";
import type { ArtistData } from "@/lib/spotify";
import type { AnalysisResult } from "@/lib/claude";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const artistId = searchParams.get("artist");

  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [phase, setPhase] = useState<"loading-artist" | "loading-analysis" | "done" | "error">(
    "loading-artist"
  );
  const [errorMsg, setErrorMsg] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!artistId) {
      router.push("/");
      return;
    }

    try {
      // Phase 1: fetch artist data
      setPhase("loading-artist");
      const artistRes = await fetch(
        `/api/artist?spotifyUrl=spotify:artist:${artistId}`
      );
      const artist = await artistRes.json();

      if (!artistRes.ok) {
        setErrorMsg(artist.error || "Failed to load artist");
        setPhase("error");
        return;
      }

      setArtistData(artist);

      // Phase 2: Claude analysis
      setPhase("loading-analysis");
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(artist),
      });
      const analysisData = await analyzeRes.json();

      if (!analyzeRes.ok) {
        setErrorMsg(analysisData.error || "Failed to analyze artist");
        setPhase("error");
        return;
      }

      setAnalysis(analysisData);
      setPhase("done");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setPhase("error");
    }
  }, [artistId, router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (phase === "error") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-4"
        style={{ backgroundColor: "#080808" }}
      >
        <div className="text-center flex flex-col gap-3">
          <p className="text-4xl">😕</p>
          <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
          <p className="text-zinc-400 text-sm">{errorMsg}</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 rounded-xl text-sm font-medium text-white transition-all"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          Try another artist
        </button>
      </div>
    );
  }

  if (phase !== "done" || !artistData) {
    return <LoadingScreen phase={phase} />;
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#080808" }}
    >
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -5%, rgba(99,102,241,0.08), transparent)",
        }}
      />

      {/* Nav */}
      <nav className="relative border-b border-[#1e1e1e] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-xs font-bold text-white">H</span>
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">helmos</span>
          </button>
          <a
            href="#cta"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            Get Started · $49/mo
          </a>
        </div>
      </nav>

      {/* Dashboard grid */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-6">
          {/* Left: Artist profile */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ArtistCard artist={artistData} />
          </div>

          {/* Center: Career snapshot */}
          <div className="flex flex-col gap-6">
            {analysis && (
              <CareerScore score={analysis.careerScore} headline={analysis.headline} />
            )}
            <div
              className="rounded-2xl border border-[#1e1e1e] p-6"
              style={{ backgroundColor: "#0e0e0e" }}
            >
              <TrackList artist={artistData} />
            </div>
          </div>

          {/* Right: AI action items */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">H</span>
              </div>
              <h2 className="text-sm font-semibold text-white">Helmos Action Plan</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#6366f1]/20 text-[#a5b4fc] border border-[#6366f1]/30">
                AI
              </span>
            </div>

            {analysis ? (
              <ActionItems items={analysis.actionItems} />
            ) : (
              <ActionItemsSkeleton />
            )}
          </div>
        </div>

        {/* CTA Section */}
        <div id="cta" className="mt-12">
          <div
            className="relative rounded-2xl border border-[#6366f1]/30 overflow-hidden p-8 sm:p-10 text-center"
            style={{
              backgroundColor: "#0a0a14",
              background:
                "linear-gradient(135deg, #0a0a14 0%, #0d0d1f 50%, #0a0a14 100%)",
            }}
          >
            {/* Glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% 120%, rgba(99,102,241,0.15), transparent)",
              }}
            />

            <div className="relative flex flex-col items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
                  <span className="text-xs font-bold text-white">H</span>
                </div>
                <span className="text-sm font-semibold text-[#a5b4fc]">
                  Your Helmos agent is ready
                </span>
              </div>

              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  Let us handle all of this
                </h2>
                <p className="text-zinc-400 max-w-md mx-auto text-sm leading-relaxed">
                  Your personal AI Chief of Staff executes every item on this list — and everything
                  else your music career needs.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <a
                  href="https://buy.stripe.com/PLACEHOLDER"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    boxShadow: "0 0 40px rgba(99,102,241,0.35)",
                  }}
                >
                  Get Started · $49/month
                  <span>→</span>
                </a>
                <p className="text-xs text-zinc-500">Cancel anytime · No contracts</p>
              </div>

              {/* Feature list */}
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 pt-2">
                {[
                  "Release planning & execution",
                  "Playlist pitching (50+ curators/week)",
                  "Royalty registration & recovery",
                  "Social content generation",
                  "Bio & press kit writing",
                  "Performance analytics",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-[#6366f1]" />
                    <span className="text-xs text-zinc-400">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ phase }: { phase: string }) {
  const messages = {
    "loading-artist": "Fetching your Spotify data...",
    "loading-analysis": "Generating your Helmos action plan...",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-4"
      style={{ backgroundColor: "#080808" }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.1), transparent)",
        }}
      />

      <div className="relative flex flex-col items-center gap-6 text-center">
        {/* Animated logo */}
        <div className="relative">
          <div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center"
            style={{ animation: "pulse 2s ease-in-out infinite" }}
          >
            <span className="text-2xl font-bold text-white">H</span>
          </div>
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              opacity: 0.3,
              animation: "ping 2s ease-in-out infinite",
            }}
          />
        </div>

        <div>
          <p className="text-white font-semibold text-lg mb-2">
            {messages[phase as keyof typeof messages] || "Loading..."}
          </p>
          <p className="text-zinc-500 text-sm">
            {phase === "loading-analysis"
              ? "Claude is analyzing your career data"
              : "Connecting to Spotify"}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#6366f1]"
              style={{
                animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function ActionItemsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-[#1e1e1e] bg-[#0e0e0e] animate-pulse"
        >
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1e1e1e] shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-3 bg-[#1e1e1e] rounded w-3/4" />
              <div className="h-3 bg-[#1e1e1e] rounded w-full" />
              <div className="h-3 bg-[#1e1e1e] rounded w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen phase="loading-artist" />}>
      <DashboardContent />
    </Suspense>
  );
}
