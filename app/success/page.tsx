"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const artistId = searchParams.get("artist");
  const [status, setStatus] = useState<"verifying" | "error" | "done">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!sessionId) { setStatus("error"); setErrorMsg("Missing payment session."); return; }

    fetch("/api/stripe/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, artistId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setStatus("done");
          setTimeout(() => {
            const dest = data.artistId
              ? `/intake?artist=${data.artistId}`
              : "/intake";
            router.push(dest);
          }, 1800);
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Could not verify payment.");
        }
      })
      .catch(() => { setStatus("error"); setErrorMsg("Network error. Please contact support."); });
  }, [sessionId, artistId, router]);

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="text-center flex flex-col items-center gap-6 max-w-sm">
        {status === "verifying" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center animate-pulse">
              <span className="text-2xl font-bold text-white">H</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Setting up your workspace…</h1>
              <p className="text-zinc-500 text-sm">Confirming your subscription with Stripe</p>
            </div>
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-[#6366f1]"
                  style={{ animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
              ))}
            </div>
          </>
        )}

        {status === "done" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-3xl">✓</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Helm is activated ⚡</h1>
              <p className="text-zinc-400 text-sm">Setting up your agent team…</p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">Verification failed</h1>
              <p className="text-zinc-400 text-sm mb-4">{errorMsg}</p>
              <p className="text-xs text-zinc-600">
                If you were charged, email{" "}
                <a href="mailto:artists@goodmornmusic.com" className="text-[#6366f1] underline">
                  artists@goodmornmusic.com
                </a>
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[#6366f1] hover:bg-[#5558e8] transition-colors"
            >
              Back to home
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(.8);opacity:.5}40%{transform:scale(1.2);opacity:1}}`}</style>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] animate-pulse" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
