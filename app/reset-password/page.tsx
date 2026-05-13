"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState("");
  const [tokenInvalid, setTokenInvalid] = useState(false);

  useEffect(() => {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      setTokenInvalid(true);
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setState("submitting");
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to set password. Please try again.");
        setState("idle");
        return;
      }
      router.push(data.redirect || "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setState("idle");
    }
  }

  if (tokenInvalid) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid reset link</h1>
          <p className="text-zinc-500 text-sm mb-6">
            This link is missing or malformed. Please request a new one.
          </p>
          <a
            href="/forgot-password"
            className="inline-block py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 transition-opacity"
          >
            Request a new link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl font-bold text-white">H</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Set your password</h1>
          <p className="text-zinc-500 text-sm">Choose a new password for your Helm account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-xl bg-[#111] border border-[#1e1e1e] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-xl bg-[#111] border border-[#1e1e1e] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <label className="flex items-center gap-2 text-xs text-zinc-500 px-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="accent-[#6366f1]"
            />
            Show password
          </label>
          <button
            type="submit"
            disabled={state === "submitting"}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {state === "submitting" ? "Setting password…" : "Set password and sign in"}
          </button>
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080808]" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
