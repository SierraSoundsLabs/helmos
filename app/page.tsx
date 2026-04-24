"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const LOADING_STEPS = [
  "Scanning your Spotify profile...",
  "Analyzing your career data...",
  "Building your dashboard...",
];

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // Magic link login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginState, setLoginState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [loginError, setLoginError] = useState("");

  // Password login/register state
  const [loginTab, setLoginTab] = useState<"magic" | "password">("magic");
  const [pwMode, setPwMode] = useState<"login" | "register">("login");
  const [pwEmail, setPwEmail] = useState("");
  const [pwPassword, setPwPassword] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwShowPass, setPwShowPass] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "expired") setLoginError("Your login link has expired. Please request a new one.");
    else if (err === "invalid") setLoginError("Invalid login link. Please request a new one.");
    else if (err === "server") setLoginError("Something went wrong. Please try again.");
  }, [searchParams]);

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

    const interval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev < LOADING_STEPS.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      router.push(`/dashboard?artist=${artistId}`);
    }, 1500);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const email = loginEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setLoginError("Please enter a valid email address.");
      return;
    }

    setLoginState("sending");

    try {
      const res = await fetch("/api/auth/magic/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setLoginState("error");
        setLoginError("Something went wrong. Please try again.");
        return;
      }

      setLoginState("sent");
    } catch {
      setLoginState("error");
      setLoginError("Something went wrong. Please try again.");
    }
  }

  async function handlePasswordAuth(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    const email = pwEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { setPwError("Please enter a valid email address."); return; }
    if (!pwPassword || pwPassword.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (pwMode === "register" && pwPassword !== pwConfirm) { setPwError("Passwords do not match."); return; }

    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pwMode, email, password: pwPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPwError(data.error || "Something went wrong. Please try again.");
        return;
      }
      router.push(data.redirect || "/dashboard");
    } catch {
      setPwError("Something went wrong. Please try again.");
    } finally {
      setPwLoading(false);
    }
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

          {/* Spotify URL input */}
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
            Free · No account required · Try 3 days free · $29/mo Helmos Pro
          </p>

          {/* ── MEMBER LOGIN ── */}
          <div className="w-full border-t border-[#1e1e1e] pt-6 flex flex-col gap-4">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Already a member?</p>

            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-[#111] border border-[#2e2e2e] rounded-xl self-start">
              {(["magic", "password"] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLoginTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    loginTab === tab
                      ? "bg-[#1e1e1e] text-white shadow"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab === "magic" ? "Magic Link" : "Password"}
                </button>
              ))}
            </div>

            {/* Magic Link tab */}
            {loginTab === "magic" && (
              loginState === "sent" ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-full bg-[#6366f1]/10 border border-[#6366f1]/30 flex items-center justify-center">
                    <span className="text-lg">📬</span>
                  </div>
                  <p className="text-sm text-white font-medium">Check your inbox</p>
                  <p className="text-xs text-zinc-500 text-center">
                    We sent a login link to <span className="text-zinc-300">{loginEmail}</span>.
                    <br />It expires in 15 minutes.
                  </p>
                  <button
                    onClick={() => { setLoginState("idle"); setLoginEmail(""); }}
                    className="text-xs text-[#6366f1] hover:underline mt-1"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="w-full flex flex-col gap-3">
                  <div className="relative flex items-center gap-2 bg-[#111] border border-[#2e2e2e] rounded-xl px-4 py-3 focus-within:border-[#6366f1]/60 transition-colors">
                    <MailIcon />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                      autoComplete="email"
                    />
                  </div>
                  {loginError && <p className="text-xs text-red-400 text-center">{loginError}</p>}
                  <button
                    type="submit"
                    disabled={loginState === "sending"}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white border border-[#2e2e2e] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#6366f1]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loginState === "sending" ? "Sending…" : "Email me a login link →"}
                  </button>
                </form>
              )
            )}

            {/* Password tab */}
            {loginTab === "password" && (
              <form onSubmit={handlePasswordAuth} className="w-full flex flex-col gap-3">
                <div className="relative flex items-center gap-2 bg-[#111] border border-[#2e2e2e] rounded-xl px-4 py-3 focus-within:border-[#6366f1]/60 transition-colors">
                  <MailIcon />
                  <input
                    type="email"
                    value={pwEmail}
                    onChange={e => setPwEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                    autoComplete="email"
                  />
                </div>
                <div className="relative flex items-center gap-2 bg-[#111] border border-[#2e2e2e] rounded-xl px-4 py-3 focus-within:border-[#6366f1]/60 transition-colors">
                  <LockIcon />
                  <input
                    type={pwShowPass ? "text" : "password"}
                    value={pwPassword}
                    onChange={e => setPwPassword(e.target.value)}
                    placeholder="Password"
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                    autoComplete={pwMode === "register" ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setPwShowPass(v => !v)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                    tabIndex={-1}
                  >
                    {pwShowPass ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {pwMode === "register" && (
                  <div className="relative flex items-center gap-2 bg-[#111] border border-[#2e2e2e] rounded-xl px-4 py-3 focus-within:border-[#6366f1]/60 transition-colors">
                    <LockIcon />
                    <input
                      type={pwShowPass ? "text" : "password"}
                      value={pwConfirm}
                      onChange={e => setPwConfirm(e.target.value)}
                      placeholder="Confirm password"
                      className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                      autoComplete="new-password"
                    />
                  </div>
                )}
                {pwError && <p className="text-xs text-red-400 text-center">{pwError}</p>}
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white border border-[#2e2e2e] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#6366f1]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {pwLoading ? "Signing in…" : pwMode === "register" ? "Create account →" : "Sign In →"}
                </button>
                <button
                  type="button"
                  onClick={() => { setPwMode(m => m === "login" ? "register" : "login"); setPwError(""); setPwConfirm(""); }}
                  className="text-xs text-zinc-500 hover:text-[#6366f1] transition-colors text-center"
                >
                  {pwMode === "login" ? "First time? Set a password →" : "← Back to sign in"}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080808]" />}>
      <HomeContent />
    </Suspense>
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

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 shrink-0">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 shrink-0">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}
