"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a Spotify artist URL");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/artist?spotifyUrl=${encodeURIComponent(url.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch artist data");
        setLoading(false);
        return;
      }

      router.push(`/dashboard?artist=${data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "#080808" }}
    >
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12), transparent)",
        }}
      />

      <div className="relative w-full max-w-xl flex flex-col items-center text-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
            <span className="text-sm font-bold text-white">H</span>
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">helmos</span>
        </div>

        {/* Hero text */}
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight">
            Your AI Chief of Staff{" "}
            <span className="bg-gradient-to-r from-[#6366f1] to-[#a78bfa] bg-clip-text text-transparent">
              for music
            </span>
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed max-w-md mx-auto">
            Paste your Spotify artist link. Get a personalized career analysis and a list of
            actions your Helmos agent can execute right now.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
              <SpotifyIcon />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              placeholder="https://open.spotify.com/artist/..."
              className="w-full pl-11 pr-4 py-4 rounded-xl text-white placeholder-zinc-600 text-sm outline-none transition-all focus:ring-2 focus:ring-[#6366f1]/60"
              style={{
                backgroundColor: "#0e0e0e",
                border: error ? "1px solid rgba(239,68,68,0.5)" : "1px solid #1e1e1e",
              }}
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-red-400 text-left px-1">{error}</p>}

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full py-4 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                loading || !url.trim()
                  ? "#1e1e1e"
                  : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              boxShadow:
                loading || !url.trim() ? "none" : "0 0 30px rgba(99,102,241,0.3)",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner />
                Fetching artist data...
              </span>
            ) : (
              "Analyze My Career →"
            )}
          </button>
        </form>

        {/* Trust signals */}
        <div className="flex flex-col gap-3 items-center">
          <p className="text-xs text-zinc-600">
            No account needed · Free analysis · Takes 5 seconds
          </p>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            {["Release planning", "Playlist pitching", "Royalty recovery"].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-[#6366f1]" />
                <span className="text-xs text-zinc-500">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="fixed bottom-6 text-xs text-zinc-700">© 2025 Helmos · helmos.co</p>
    </div>
  );
}

function SpotifyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
