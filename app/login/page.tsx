"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "signin" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: tab === "signin" ? "login" : "register",
          email,
          password,
        }),
      });
      const data = await res.json();
      if (data.ok && data.redirect) {
        router.push(data.redirect);
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl font-bold text-white">H</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Welcome to Helmos</h1>
          <p className="text-zinc-500 text-sm">Your AI music career manager</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#111] border border-[#1e1e1e] rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => { setTab("signin"); setErrorMsg(""); setStatus("idle"); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "signin"
                ? "bg-[#6366f1] text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setErrorMsg(""); setStatus("idle"); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "register"
                ? "bg-[#6366f1] text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="you@yourband.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl bg-[#111] border border-[#1e1e1e] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
            className="w-full px-4 py-3 rounded-xl bg-[#111] border border-[#1e1e1e] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {status === "loading"
              ? tab === "signin"
                ? "Signing in…"
                : "Creating account…"
              : tab === "signin"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        {/* Error */}
        {status === "error" && errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {errorMsg}
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#1e1e1e]" />
          <span className="text-zinc-600 text-xs">or</span>
          <div className="flex-1 h-px bg-[#1e1e1e]" />
        </div>

        {/* Google OAuth */}
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-[#111] border border-[#1e1e1e] text-zinc-200 text-sm font-medium hover:bg-[#181818] hover:border-[#2e2e2e] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
            <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
            <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
            <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </a>

        {/* Magic link fallback */}
        <p className="text-center text-zinc-600 text-xs mt-5">
          Prefer magic link?{" "}
          <a href="/" className="text-[#6366f1] hover:underline">
            Send me a login email →
          </a>
        </p>

        <p className="text-center text-zinc-700 text-xs mt-3">
          Don&apos;t have a subscription?{" "}
          <a href="/" className="text-[#6366f1] hover:underline">
            Get started
          </a>
        </p>
      </div>
    </div>
  );
}
