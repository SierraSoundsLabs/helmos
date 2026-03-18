"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        // Cookie set server-side — redirect to dashboard
        router.push(data.dashboardUrl ?? "/");
      } else {
        setStatus("error");
        setMsg(data.error ?? "No active subscription found for that email.");
      }
    } catch {
      setStatus("error");
      setMsg("Something went wrong. Try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl font-bold text-white">H</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Sign in to Helm</h1>
          <p className="text-zinc-500 text-sm">Enter the email you used when you subscribed</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="you@yourband.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {status === "loading" ? "Looking up your account…" : "Continue"}
          </button>
        </form>

        {status === "error" && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {msg}
            <div className="mt-2 text-xs text-zinc-600">
              Need help? <a href="mailto:artists@goodmornmusic.com" className="text-[#6366f1] underline">Contact support</a>
            </div>
          </div>
        )}

        <p className="text-center text-zinc-600 text-xs mt-6">
          Don't have a subscription?{" "}
          <a href="/" className="text-[#6366f1] underline">Get started</a>
        </p>
      </div>
    </div>
  );
}
