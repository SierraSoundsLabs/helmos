"use client";

import { useEffect, useState } from "react";

// "Add Helm to your home screen" banner.
//
// Rules (per PR A spec, 2026-06-03):
//   - Only render on mobile (iOS Safari or Android Chrome viewport).
//   - Only render to logged-in/paid users — the parent gates by passing
//     `eligible` (typically `isPaid`).
//   - Hide if the app is already installed (display-mode: standalone OR
//     iOS navigator.standalone).
//   - Dismissable; localStorage flag suppresses re-prompt for 14 days.
//
// iOS Safari has no install JS API — the OS only installs via
// Share → "Add to Home Screen". So the banner is instructional, not
// a one-tap install. Android Chrome's beforeinstallprompt is wired in
// here too: if present, the CTA fires a real prompt; otherwise it
// shows the iOS-style instructions.

const DISMISS_KEY = "helm_install_dismissed_at";
const DISMISS_DAYS = 14;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari, iPad in "request mobile site", Android Chrome.
  // Width check catches tablets in landscape. Touch check filters out
  // desktop browsers spoofing a mobile UA in devtools.
  const narrow = window.matchMedia("(max-width: 820px)").matches;
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  return narrow && touch;
}

function isAlreadyInstalled(): boolean {
  if (typeof window === "undefined") return false;
  // Android / desktop PWA detection.
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari sets navigator.standalone === true when launched from
  // the home screen. Not on the standard nav type, hence the cast.
  if ((navigator as unknown as { standalone?: boolean }).standalone) return true;
  return false;
}

function dismissedRecently(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return ageDays < DISMISS_DAYS;
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad on iPadOS 13+ identifies as Mac with touch — include it.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

export default function InstallAppBanner({ eligible }: { eligible: boolean }) {
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Listen for Android Chrome's install prompt event. Stash it so the
  // CTA can fire it on demand. If it never fires, we fall back to the
  // iOS-style instructional sheet on tap.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // Decide whether to show, after mount (so the SSR pass renders nothing
  // and the client decides based on actual UA / installed state).
  useEffect(() => {
    if (!eligible) return;
    if (!isMobileViewport()) return;
    if (isAlreadyInstalled()) return;
    if (dismissedRecently()) return;
    setVisible(true);
  }, [eligible]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private mode etc — just hide for this session.
    }
    setVisible(false);
    setShowIosHelp(false);
  };

  const install = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setVisible(false);
        }
      } catch {
        // If prompt() throws, fall through to iOS instructions.
        setShowIosHelp(true);
      }
      setDeferredPrompt(null);
      return;
    }
    // No native prompt available (iOS Safari, or Android Chrome that
    // already used its prompt). Show step-by-step instructions.
    setShowIosHelp(true);
  };

  if (!visible) return null;

  return (
    <>
      <div
        className="mx-4 mt-3 mb-1 flex items-center gap-3 rounded-xl border border-[#1e1e1e] bg-gradient-to-r from-[#111] to-[#0e0e0e] px-3 py-2.5 sm:hidden"
        role="region"
        aria-label="Install Helm to your home screen"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
          <span className="text-sm font-bold text-white">H</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-tight text-white">Add Helm to your home screen</div>
          <div className="text-[11px] leading-tight text-zinc-400">Faster access · push notifications for replies</div>
        </div>
        <button
          onClick={install}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
        >
          Add
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl border border-[#1e1e1e] bg-[#0e0e0e] p-5 text-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
                <span className="text-base font-bold text-white">H</span>
              </div>
              <div>
                <div className="text-sm font-semibold">Install Helm</div>
                <div className="text-[11px] text-zinc-400">Takes 3 seconds</div>
              </div>
            </div>

            {isIos() ? (
              <ol className="flex flex-col gap-3 text-[13px] text-zinc-200">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-[11px] font-semibold text-zinc-300">1</span>
                  <span>
                    Tap the{" "}
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#1a1a1a] px-1.5 py-0.5 align-middle">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 16V3M12 3l-4 4M12 3l4 4" />
                        <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                      </svg>
                      Share
                    </span>{" "}
                    button in Safari.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-[11px] font-semibold text-zinc-300">2</span>
                  <span>Scroll and tap <strong>Add to Home Screen</strong>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-[11px] font-semibold text-zinc-300">3</span>
                  <span>Tap <strong>Add</strong>. Helm now lives on your home screen.</span>
                </li>
              </ol>
            ) : (
              <ol className="flex flex-col gap-3 text-[13px] text-zinc-200">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-[11px] font-semibold text-zinc-300">1</span>
                  <span>Tap the <strong>⋮</strong> menu in Chrome.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-[11px] font-semibold text-zinc-300">2</span>
                  <span>Tap <strong>Add to Home screen</strong>, then <strong>Install</strong>.</span>
                </li>
              </ol>
            )}

            <button
              onClick={() => setShowIosHelp(false)}
              className="mt-5 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
