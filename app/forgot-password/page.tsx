"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setState("sending");
    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      if (!res.ok) {
        setState("error");
        setError("Something went wrong. Please try again.");
        return;
      }
      setState("sent");
    } catch {
      setState("error");
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl font-bold text-white">H</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Reset your password</h1>
          <p className="text-zinc-500 text-sm">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
        </div>

        {state === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-full bg-[#6366f1]/10 border border-[#6366f1]/30 flex items-center justify-center">
              <span className="text-lg">📬</span>
            </div>
            <p className="text-sm text-white font-medium">Check your inbox</p>
            <p className="text-xs text-zinc-500 text-center">
              If your email has a Helm subscription, we sent a reset link to{" "}
              <span className="text-zinc-300">{email}</span>.
              <br />
              Check your spam folder if you don&apos;t see it. The link expires in 1 hour.
            </p>
            <button
              onClick={() => {
                setState("idle");
                setEmail("");
              }}
              className="text-xs text-[#6366f1] hover:underline mt-1"
            >
              Use a different email
            </button>
          </div>
        ) : (
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
            <button
              type="submit"
              disabled={state === "sending"}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {state === "sending" ? "Sending…" : "Send reset link"}
            </button>
            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}
          </form>
        )}

        <p className="text-center text-zinc-600 text-xs mt-6">
          <Link href="/login" className="hover:text-zinc-400 hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
