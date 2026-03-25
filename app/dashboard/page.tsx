"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { ArtistData } from "@/lib/spotify";
import type { Release } from "@/lib/spotify";
import type { AnalysisResult } from "@/lib/claude";
import QueueDashboard from "@/components/QueueDashboard";
import OpportunityFeed from "@/components/OpportunityFeed";
import type { OutreachDraft } from "@/app/api/helm/outreach/generate/route";
import type { OutreachRecord } from "@/app/api/helm/outreach/send/route";
import type { InboundEmail } from "@/app/api/helm/outreach/webhook/route";
import { toSlug, artistEmail } from "@/lib/email";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STRIPE_PRICE = "price_1T9CqJACiFFf49dvYHMObuOd";

const CATEGORY_COLORS: Record<string, string> = {
  Royalties:   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Playlisting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Touring:     "bg-sky-500/20 text-sky-400 border-sky-500/30",
  Social:      "bg-pink-500/20 text-pink-400 border-pink-500/30",
  Press:       "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Strategy:    "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  Release:     "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Sync:        "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Outreach:    "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Merch:       "bg-rose-500/20 text-rose-400 border-rose-500/30",
  Advertising: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  Booking:     "bg-teal-500/20 text-teal-400 border-teal-500/30",
  Labels:      "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const URGENCY_COLORS: Record<string, string> = {
  "Tonight":    "bg-red-500/20 text-red-400 border-red-500/30",
  "This week":  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "This month": "bg-zinc-700/60 text-zinc-400 border-zinc-600/30",
};

const STAGE_CONFIG = {
  Emerging:    { color: "text-zinc-400",    bar: "#71717a", pct: 20 },
  Growing:     { color: "text-blue-400",    bar: "#3b82f6", pct: 45 },
  Established: { color: "text-emerald-400", bar: "#10b981", pct: 70 },
  Breakthrough:{ color: "text-yellow-400",  bar: "#f59e0b", pct: 90 },
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface ChatMessage { role: "user" | "assistant"; content: string; }
type DocType = "one-sheet" | "bio" | "press-release" | "pitch-email";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function Sparkline({ popularity }: { popularity: number }) {
  const base = Math.max(10, popularity - 30);
  const pts = [base, base+5, base-3, base+8, base+2, base+12, base+6, popularity];
  const max = Math.max(...pts), min = Math.min(...pts), range = max - min || 1;
  const w = 120, h = 40, pad = 4;
  const xs = pts.map((_, i) => pad + (i / (pts.length - 1)) * (w - pad * 2));
  const ys = pts.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${d} L${xs[xs.length-1]},${h} L${xs[0]},${h} Z`;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3"/>
        <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
      </linearGradient></defs>
      <path d={area} fill="url(#sg)"/>
      <path d={d} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="3" fill="#6366f1"/>
    </svg>
  );
}

// ─── DOC MODAL ────────────────────────────────────────────────────────────────
function DocModal({ content, title, onClose }: { content: string; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] bg-[#0e0e0e] border border-[#2e2e2e] rounded-2xl flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e1e]">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <div className="flex gap-2">
            <button onClick={copy} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${copied ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1e1e1e] text-zinc-300 hover:bg-[#2e2e2e]"}`}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e1e1e] text-zinc-400 hover:bg-[#2e2e2e] transition-colors">✕</button>
          </div>
        </div>
        <div className="overflow-y-auto p-5">
          <pre className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">{content}</pre>
        </div>
      </div>
    </div>
  );
}

// ─── SPEND SELECTOR ───────────────────────────────────────────────────────────
function SpendSelector({ onChange }: { onChange: (daily: number, days: number, total: number) => void }) {
  const [daily, setDaily] = useState(10);
  const [days, setDays] = useState(7);
  const [customDaily, setCustomDaily] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const dailyOptions = [10, 25, 50, 100];
  const durationOptions = [7, 14, 30];

  const effectiveDaily = useCustom ? (parseInt(customDaily) || 0) : daily;
  const total = effectiveDaily * days;

  useEffect(() => {
    onChange(effectiveDaily, days, total);
  }, [effectiveDaily, days, total, onChange]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-zinc-400 mb-2">Daily spend</p>
        <div className="flex gap-2 flex-wrap">
          {dailyOptions.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { setDaily(opt); setUseCustom(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                !useCustom && daily === opt
                  ? "bg-[#6366f1]/20 text-[#a5b4fc] border-[#6366f1]/50"
                  : "bg-[#1a1a1a] text-zinc-400 border-[#2e2e2e] hover:border-[#3e3e3e]"
              }`}
            >
              ${opt}/day
            </button>
          ))}
          <button
            type="button"
            onClick={() => setUseCustom(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              useCustom
                ? "bg-[#6366f1]/20 text-[#a5b4fc] border-[#6366f1]/50"
                : "bg-[#1a1a1a] text-zinc-400 border-[#2e2e2e] hover:border-[#3e3e3e]"
            }`}
          >
            Custom
          </button>
        </div>
        {useCustom && (
          <input
            type="number"
            min={10}
            value={customDaily}
            onChange={e => setCustomDaily(e.target.value)}
            placeholder="Enter daily amount ($)"
            className="mt-2 w-full bg-[#111] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#6366f1]/50"
          />
        )}
      </div>

      <div>
        <p className="text-xs text-zinc-400 mb-2">Duration</p>
        <div className="flex gap-2">
          {durationOptions.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setDays(opt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                days === opt
                  ? "bg-[#6366f1]/20 text-[#a5b4fc] border-[#6366f1]/50"
                  : "bg-[#1a1a1a] text-zinc-400 border-[#2e2e2e] hover:border-[#3e3e3e]"
              }`}
            >
              {opt} days
            </button>
          ))}
        </div>
      </div>

      {total > 0 && (
        <div className="bg-[#0d1a0d] border border-emerald-500/30 rounded-lg px-4 py-2.5">
          <p className="text-xs text-zinc-400">Total campaign spend</p>
          <p className="text-xl font-bold text-emerald-400">${total.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-500">${effectiveDaily}/day × {days} days</p>
        </div>
      )}
    </div>
  );
}

// ─── PAID MEDIA MODAL ─────────────────────────────────────────────────────────
type CampaignType = "show" | "release" | "general";

function PaidMediaModal({
  artistData,
  onClose,
}: {
  artistData: ArtistData;
  onClose: () => void;
}) {
  const [campaignType, setCampaignType] = useState<CampaignType | null>(null);
  const [hasCreative, setHasCreative] = useState<boolean | null>(null);
  const [step, setStep] = useState<"choose" | "show" | "release-choice" | "release-upload" | "release-assets" | "release-preview" | "general">("choose");

  // Show form state
  const [showFlyerFile, setShowFlyerFile] = useState<File | null>(null);
  const [showFlyerPreview, setShowFlyerPreview] = useState<string | null>(null);
  const [showName, setShowName] = useState("");
  const [showDate, setShowDate] = useState("");
  const [showVenue, setShowVenue] = useState("");
  const [showNotes, setShowNotes] = useState("");

  // Release form state
  const [releaseCreativeFile, setReleaseCreativeFile] = useState<File | null>(null);
  const [releaseId, setReleaseId] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");

  // Asset creation state
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkUrl, setArtworkUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [assetReleaseId, setAssetReleaseId] = useState("");

  // Preview state
  const [previewData, setPreviewData] = useState<{ artworkUrl: string; message: string } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [spendConfig, setSpendConfig] = useState({ daily: 10, days: 7, total: 70 });

  // General form state
  const [generalGoals, setGeneralGoals] = useState("");
  const [generalSpend, setGeneralSpend] = useState({ daily: 10, days: 7, total: 70 });

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const releases = artistData.allReleases || [];

  function handleFlyerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowFlyerFile(file);
    const reader = new FileReader();
    reader.onload = ev => setShowFlyerPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function submitShowInquiry() {
    if (!showFlyerFile || !showName || !showDate || !showVenue) return;
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("flyer", showFlyerFile);
      fd.append("showName", showName);
      fd.append("date", showDate);
      fd.append("venue", showVenue);
      fd.append("notes", showNotes);
      fd.append("artistName", artistData.name);
      const res = await fetch("/api/helm/media/show-inquiry", { method: "POST", body: fd });
      if (res.ok) {
        setSuccessMessage("Your flyer has been sent to the Good Morning Music team. They'll be in touch within 24 hours.");
        setSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitReleaseInquiry() {
    if (!releaseCreativeFile || !releaseId) return;
    setIsSubmitting(true);
    try {
      const release = releases.find(r => r.id === releaseId);
      const fd = new FormData();
      fd.append("creative", releaseCreativeFile);
      fd.append("releaseId", releaseId);
      fd.append("releaseName", release?.name || "");
      fd.append("notes", releaseNotes);
      fd.append("artistName", artistData.name);
      const res = await fetch("/api/helm/media/release-inquiry", { method: "POST", body: fd });
      if (res.ok) {
        setSuccessMessage("Your ad creative has been sent to the Good Morning Music team. They'll be in touch within 24 hours.");
        setSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function generatePreview() {
    if (!assetReleaseId) return;
    setIsPreviewLoading(true);
    try {
      const fd = new FormData();
      if (artworkFile) fd.append("artwork", artworkFile);
      if (audioFile) fd.append("audio", audioFile);
      fd.append("releaseId", assetReleaseId);
      fd.append("artworkUrl", artworkUrl);
      const res = await fetch("/api/helm/media/preview", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
        setStep("release-preview");
      }
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function launchCampaign() {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/helm/media/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId: artistData.id,
          amount: spendConfig.total,
          campaignType: "release",
          releaseId: assetReleaseId,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitGeneralInquiry() {
    if (!generalGoals) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/helm/media/release-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistName: artistData.name,
          campaignType: "general",
          goals: generalGoals,
          dailyBudget: generalSpend.daily,
          duration: generalSpend.days,
          total: generalSpend.total,
        }),
      });
      if (res.ok) {
        setSuccessMessage("Your campaign request has been sent to the Good Morning Music team. They'll be in touch within 24 hours.");
        setSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] bg-[#0e0e0e] border border-[#2e2e2e] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">🎯</span>
            <h3 className="text-sm font-semibold text-white">Buy Paid Media</h3>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e1e1e] text-zinc-400 hover:bg-[#2e2e2e] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-5 flex flex-col gap-5">
          {/* Success state */}
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl">
                ✓
              </div>
              <p className="text-sm font-semibold text-emerald-400">Submitted!</p>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">{successMessage}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] transition-colors"
              >
                Done
              </button>
            </div>
          ) : step === "choose" ? (
            /* Step 1: Choose campaign type */
            <div className="flex flex-col gap-4">
              <p className="text-sm text-zinc-300 font-medium">What would you like to promote?</p>
              <div className="flex flex-col gap-3">
                {[
                  { type: "show" as CampaignType, icon: "🎤", label: "A Show", desc: "Promote a live show with your flyer" },
                  { type: "release" as CampaignType, icon: "🎵", label: "A Release", desc: "Promote a music release with paid ads" },
                  { type: "general" as CampaignType, icon: "⭐", label: "General Promotion", desc: "General artist promotion campaign" },
                ].map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => {
                      setCampaignType(opt.type);
                      setStep(opt.type === "show" ? "show" : opt.type === "release" ? "release-choice" : "general");
                    }}
                    className="flex items-center gap-3 p-4 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#6366f1]/40 hover:bg-[#12121a] transition-all text-left"
                  >
                    <span className="text-2xl shrink-0">{opt.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{opt.label}</p>
                      <p className="text-xs text-zinc-500">{opt.desc}</p>
                    </div>
                    <span className="ml-auto text-zinc-600">→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : step === "show" ? (
            /* Step 2A: Show campaign */
            <div className="flex flex-col gap-4">
              <button onClick={() => setStep("choose")} className="text-xs text-zinc-500 hover:text-zinc-300 self-start transition-colors">← Back</button>
              <p className="text-sm font-semibold text-white">Upload your show flyer</p>

              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-[#2e2e2e] rounded-xl cursor-pointer hover:border-[#6366f1]/40 transition-colors">
                <span className="text-2xl">{showFlyerFile ? "✓" : "📁"}</span>
                <span className="text-xs text-zinc-400">{showFlyerFile ? showFlyerFile.name : "Click to upload (JPG, PNG, GIF, WEBP)"}</span>
                <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleFlyerChange} />
              </label>

              {showFlyerPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={showFlyerPreview} alt="Flyer preview" className="w-full max-h-48 object-contain rounded-lg border border-[#1e1e1e]" />
              )}

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Show name / artist name</label>
                  <input
                    type="text"
                    value={showName}
                    onChange={e => setShowName(e.target.value)}
                    placeholder={`${artistData.name} Live`}
                    className="w-full bg-[#111] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#6366f1]/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Date</label>
                    <input
                      type="date"
                      value={showDate}
                      onChange={e => setShowDate(e.target.value)}
                      className="w-full bg-[#111] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#6366f1]/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Venue</label>
                    <input
                      type="text"
                      value={showVenue}
                      onChange={e => setShowVenue(e.target.value)}
                      placeholder="Venue name"
                      className="w-full bg-[#111] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#6366f1]/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Notes for the team (optional)</label>
                  <textarea
                    value={showNotes}
                    onChange={e => setShowNotes(e.target.value)}
                    rows={3}
                    placeholder="Any targeting preferences, links, or special instructions..."
                    className="w-full bg-[#111] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#6366f1]/50 resize-none"
                  />
                </div>
              </div>

              <button
                onClick={submitShowInquiry}
                disabled={isSubmitting || !showFlyerFile || !showName || !showDate || !showVenue}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Sending…" : "Submit →"}
              </button>
            </div>
          ) : step === "release-choice" ? (
            /* Step 2B: Release — has creative? */
            <div className="flex flex-col gap-4">
              <button onClick={() => setStep("choose")} className="text-xs text-zinc-500 hover:text-zinc-300 self-start transition-colors">← Back</button>
              <p className="text-sm font-semibold text-white">Do you already have ad creative designed?</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setHasCreative(true); setStep("release-upload"); }}
                  className="flex items-center gap-3 p-4 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#6366f1]/40 hover:bg-[#12121a] transition-all text-left"
                >
                  <span className="text-xl">✅</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Yes, I have an ad</p>
                    <p className="text-xs text-zinc-500">Upload your existing creative (JPG, PNG, MP4, GIF)</p>
                  </div>
                </button>
                <button
                  onClick={() => { setHasCreative(false); setStep("release-assets"); }}
                  className="flex items-center gap-3 p-4 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#6366f1]/40 hover:bg-[#12121a] transition-all text-left"
                >
                  <span className="text-xl">🎨</span>
                  <div>
                    <p className="text-sm font-semibold text-white">No, create one for me</p>
                    <p className="text-xs text-zinc-500">Share artwork + audio and we'll build your ad</p>
                  </div>
                </button>
              </div>
            </div>
          ) : step === "release-upload" ? (
            /* Step 2B-i: Upload existing ad */
            <div className="flex flex-col gap-4">
              <button onClick={() => setStep("release-choice")} className="text-xs text-zinc-500 hover:text-zinc-300 self-start transition-colors">← Back</button>
              <p className="text-sm font-semibold text-white">Upload your ad creative</p>

              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-[#2e2e2e] rounded-xl cursor-pointer hover:border-[#6366f1]/40 transition-colors">
                <span className="text-2xl">{releaseCreativeFile ? "✓" : "📁"}</span>
                <span className="text-xs text-zinc-400">{releaseCreativeFile ? releaseCreativeFile.name : "Click to upload (JPG, PNG, MP4, GIF)"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,video/mp4"
                  className="hidden"
                  onChange={e => setReleaseCreativeFile(e.target.files?.[0] || null)}
                />
              </label>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Which release is this for?</label>
                <select
                  value={releaseId}
                  onChange={e => setReleaseId(e.target.value)}
                  className="w-full bg-[#111] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#6366f1]/50"
                >
                  <option value="">Select a release…</option>
                  {releases.map((r: Release) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.releaseDate?.slice(0, 4)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Notes (optional)</label>
                <textarea
                  value={releaseNotes}
                  onChange={e => setReleaseNotes(e.target.value)}
                  rows={3}
                  placeholder="Targeting preferences, budget range, special instructions..."
                  className="w-full bg-[#111] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#6366f1]/50 resize-none"
                />
              </div>

              <button
                onClick={submitReleaseInquiry}
                disabled={isSubmitting || !releaseCreativeFile || !releaseId}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Sending…" : "Submit →"}
              </button>
            </div>
          ) : step === "release-assets" ? (
            /* Step 2B-ii: Create ad from assets */
            <div className="flex flex-col gap-4">
              <button onClick={() => setStep("release-choice")} className="text-xs text-zinc-500 hover:text-zinc-300 self-start transition-colors">← Back</button>
              <p className="text-sm font-semibold text-white">Share your assets</p>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Artwork</label>
                  <label className="flex items-center gap-2 p-3 border border-dashed border-[#2e2e2e] rounded-lg cursor-pointer hover:border-[#6366f1]/40 transition-colors">
                    <span className="text-base">{artworkFile ? "✓" : "🖼️"}</span>
                    <span className="text-xs text-zinc-400">{artworkFile ? artworkFile.name : "Upload artwork (JPG, PNG)"}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => setArtworkFile(e.target.files?.[0] || null)} />
                  </label>
                  <p className="text-[10px] text-zinc-600 mt-1">— or paste a URL —</p>
                  <input
                    type="url"
                    value={artworkUrl}
                    onChange={e => setArtworkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full mt-1 bg-[#111] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#6366f1]/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Audio file</label>
                  <label className="flex items-center gap-2 p-3 border border-dashed border-[#2e2e2e] rounded-lg cursor-pointer hover:border-[#6366f1]/40 transition-colors">
                    <span className="text-base">{audioFile ? "✓" : "🎵"}</span>
                    <span className="text-xs text-zinc-400">{audioFile ? audioFile.name : "Upload audio (MP3, WAV, AAC)"}</span>
                    <input type="file" accept="audio/mpeg,audio/wav,audio/aac,audio/mp3" className="hidden" onChange={e => setAudioFile(e.target.files?.[0] || null)} />
                  </label>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Which release?</label>
                  <select
                    value={assetReleaseId}
                    onChange={e => setAssetReleaseId(e.target.value)}
                    className="w-full bg-[#111] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#6366f1]/50"
                  >
                    <option value="">Select a release…</option>
                    {releases.map((r: Release) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.releaseDate?.slice(0, 4)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={generatePreview}
                disabled={isPreviewLoading || (!artworkFile && !artworkUrl) || !assetReleaseId}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPreviewLoading ? "Generating preview…" : "Preview →"}
              </button>
            </div>
          ) : step === "release-preview" ? (
            /* Preview + spend selector */
            <div className="flex flex-col gap-4">
              <button onClick={() => setStep("release-assets")} className="text-xs text-zinc-500 hover:text-zinc-300 self-start transition-colors">← Back</button>
              <p className="text-sm font-semibold text-white">Campaign Preview</p>

              {previewData?.artworkUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewData.artworkUrl} alt="Ad preview" className="w-full max-h-56 object-contain rounded-lg border border-[#1e1e1e]" />
              )}
              {previewData?.message && (
                <p className="text-xs text-zinc-400">{previewData.message}</p>
              )}

              <SpendSelector onChange={(daily, days, total) => setSpendConfig({ daily, days, total })} />

              <button
                onClick={launchCampaign}
                disabled={isSubmitting || spendConfig.total === 0}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
              >
                {isSubmitting ? "Redirecting to checkout…" : `Launch Campaign → $${spendConfig.total}`}
              </button>
            </div>
          ) : step === "general" ? (
            /* Step 2C: General promotion */
            <div className="flex flex-col gap-4">
              <button onClick={() => setStep("choose")} className="text-xs text-zinc-500 hover:text-zinc-300 self-start transition-colors">← Back</button>
              <p className="text-sm font-semibold text-white">Tell us about your campaign goals</p>

              <textarea
                value={generalGoals}
                onChange={e => setGeneralGoals(e.target.value)}
                rows={4}
                placeholder="What do you want to achieve? (e.g. grow followers, promote new single, increase streams...)"
                className="w-full bg-[#111] border border-[#2e2e2e] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#6366f1]/50 resize-none"
              />

              <SpendSelector onChange={(daily, days, total) => setGeneralSpend({ daily, days, total })} />

              <button
                onClick={submitGeneralInquiry}
                disabled={isSubmitting || !generalGoals || generalSpend.total === 0}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Sending…" : "Submit →"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── HELM CHAT (PAID) ─────────────────────────────────────────────────────────
function HelmChat({
  artistData, messages, onSend, isStreaming,
}: {
  artistData: ArtistData;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isStreaming: boolean;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    onSend(text);
  };

  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-xl flex flex-col h-[560px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">H</span>
          </div>
          <span className="text-xs font-semibold text-white">Helm Agent</span>
        </div>
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">ACTIVE</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-base font-bold text-white">H</span>
            </div>
            <p className="text-xs text-zinc-400 text-center max-w-[200px]">
              Your Helm agent is ready. Ask anything about {artistData.name}&apos;s career.
            </p>
            <div className="flex flex-col gap-1.5 w-full mt-2">
              {[
                `Build a release plan for my next drop`,
                `Create a one-sheet for ${artistData.name}`,
                `Find journalists to pitch my latest single to`,
                `How do I grow my fanbase this month?`,
              ].map(s => (
                <button key={s} onClick={() => onSend(s)}
                  className="text-left text-[11px] text-zinc-500 hover:text-zinc-300 bg-[#0d0d0d] hover:bg-[#141414] border border-[#1e1e1e] rounded-lg px-3 py-2 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shrink-0 mt-0.5 mr-2">
                <span className="text-[9px] font-bold text-white">H</span>
              </div>
            )}
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-[#6366f1]/20 text-white border border-[#6366f1]/30"
                : "bg-[#0d0d0d] text-zinc-200 border border-[#1e1e1e]"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shrink-0 mt-0.5 mr-2">
              <span className="text-[9px] font-bold text-white">H</span>
            </div>
            <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl px-3 py-2.5 flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"
                  style={{ animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[#1e1e1e] p-3 shrink-0">
        <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-2 focus-within:border-[#6366f1]/50 transition-colors">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder={`Ask Helm anything…`}
            className="flex-1 bg-transparent text-xs text-white placeholder-zinc-600 outline-none"
            disabled={isStreaming}
          />
          <button
            onClick={submit}
            disabled={isStreaming || !input.trim()}
            className="text-[#6366f1] hover:text-[#818cf8] transition-colors font-bold disabled:opacity-40"
          >↑</button>
        </div>
      </div>
    </div>
  );
}

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({
  artistData, analysis, isPaid, onSubscribe, onSendChat, onGenerate, onRoyaltyAudit, chatMessages, isChatStreaming,
}: {
  artistData: ArtistData;
  analysis: AnalysisResult;
  isPaid: boolean;
  onSubscribe: () => void;
  onSendChat: (text: string) => void;
  onGenerate: (type: DocType) => void;
  onRoyaltyAudit: () => void;
  chatMessages: ChatMessage[];
  isChatStreaming: boolean;
}) {
  const stage = analysis.careerStage || "Emerging";
  const stageConf = STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG] || STAGE_CONFIG.Emerging;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* Main content */}
      <div className="flex flex-col gap-6">
        {/* Tasks */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Tasks</h2>
            <span className="text-xs text-zinc-500">{analysis.tasks.length} queued by Helm</span>
          </div>
          <div className="flex flex-col gap-3">
            {analysis.tasks.map((task, i) => (
              <div key={i} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 hover:border-[#2e2e2e] transition-colors">
                <h3 className="text-sm font-semibold text-white mb-2">{task.title}</h3>
                <ul className="flex flex-col gap-1.5 mb-3">
                  {task.bullets.map((b, j) => (
                    <li key={j} className="text-xs text-zinc-400 flex gap-2">
                      <span className="text-zinc-600 shrink-0">–</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${CATEGORY_COLORS[task.category] || "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"}`}>
                      {task.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${URGENCY_COLORS[task.urgency] || "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"}`}>
                      {task.urgency}
                    </span>
                  </div>
                  {task.actionButton && (
                    <button
                      onClick={() => isPaid ? onSendChat(`Let's execute this task: ${task.title}. ${task.bullets.join(". ")}`) : onSubscribe()}
                      className="px-3 py-1 rounded-lg text-[11px] font-semibold text-white bg-[#6366f1]/80 hover:bg-[#6366f1] transition-colors shrink-0"
                    >
                      {isPaid ? task.actionButton : "Activate"} →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Career Stage */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Career Stage</p>
              <p className={`text-2xl font-bold ${stageConf.color}`}>{stage}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 mb-1">Momentum</p>
              <Sparkline popularity={artistData.spotifyPopularity} />
            </div>
          </div>
          <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${stageConf.pct}%`, background: stageConf.bar }} />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1.5">
            <span>Emerging</span><span>Growing</span><span>Established</span><span>Breakthrough</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "📣 Run Fan Ads",         desc: "Launch fan acquisition campaign",    msg: "Help me set up a fan acquisition ad campaign on Meta/Instagram. What targeting, budget, and creative do you recommend for my current stage?" },
              { label: "📄 Create One-Sheet",     desc: "Artist media kit from Spotify data", doc: "one-sheet" as DocType },
              { label: "🔗 Pre-Save Link",        desc: "For upcoming release",               msg: "I have an upcoming release and need a pre-save strategy. Walk me through what to set up and how to promote it." },
              { label: "🛍️ Launch Merch Store",   desc: "Custom designs + fulfillment",       msg: "Help me launch a merch store. What products should I start with, which platform is best, and how do I promote it?" },
              { label: "🎸 Find Open For Slots",  desc: "Submit for touring openers",         msg: "I want to find opportunities to open for touring acts. How do I identify shows in my genre and who do I contact?" },
              { label: "🔍 Royalty Audit",        desc: "Compare recordings vs PRO registrations", royaltyAudit: true },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  if (!isPaid) { onSubscribe(); return; }
                  if ("doc" in action && action.doc) onGenerate(action.doc);
                  else if ("royaltyAudit" in action && action.royaltyAudit) onRoyaltyAudit();
                  else if ("msg" in action && action.msg) onSendChat(action.msg);
                }}
                className="flex flex-col gap-1 p-3 rounded-xl border bg-[#111] border-[#1e1e1e] hover:border-[#6366f1]/40 hover:bg-[#12121a] transition-all text-left"
              >
                <span className="text-xs font-semibold text-white">{action.label}</span>
                <span className="text-[10px] text-zinc-500 leading-tight">{action.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Documents */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Documents</h2>
            {isPaid && <span className="text-[10px] text-emerald-400">Generate instantly</span>}
          </div>
          <div className="flex flex-col gap-2">
            {(analysis.documents || []).map((doc, i) => {
              const docTypeMap: Record<string, DocType> = {
                "one-sheet": "one-sheet", "bio": "bio", "artist bio": "bio",
                "press release": "press-release", "pitch email": "pitch-email", "playlist pitch": "pitch-email",
              };
              const docKey = Object.keys(docTypeMap).find(k => doc.name.toLowerCase().includes(k));
              const docType = docKey ? docTypeMap[docKey] : "one-sheet";
              return (
                <button
                  key={i}
                  onClick={() => isPaid ? onGenerate(docType) : onSubscribe()}
                  className="flex items-center gap-3 p-3 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#2e2e2e] transition-colors text-left w-full"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] flex items-center justify-center shrink-0">
                    <span className="text-sm">📄</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{doc.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{doc.description}</p>
                  </div>
                  <span className="text-[10px] text-[#6366f1] shrink-0">{isPaid ? "Generate" : "Activate"} →</span>
                </button>
              );
            })}
            <button
              onClick={() => isPaid ? onGenerate("one-sheet") : onSubscribe()}
              className="flex items-center gap-3 p-3 bg-[#111] border border-[#6366f1]/30 rounded-xl hover:border-[#6366f1]/60 transition-colors text-left w-full"
            >
              <div className="w-8 h-8 rounded-lg bg-[#6366f1]/20 border border-[#6366f1]/30 flex items-center justify-center shrink-0">
                <span className="text-sm">🔍</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Artist Research Report</p>
                <p className="text-xs text-zinc-500">Deep dive across Spotify, Instagram, TikTok, and press</p>
              </div>
              <span className="text-[10px] text-[#6366f1] shrink-0">{isPaid ? "Build" : "Activate"} →</span>
            </button>
          </div>
        </div>

        {/* Opportunities */}
        <OpportunityFeed
          artistId={artistData.id}
          artistName={artistData.name}
          genres={artistData.genres ?? []}
          monthlyListeners={typeof artistData.monthlyListeners === "number" ? artistData.monthlyListeners : 0}
        />
      </div>

      {/* Right: Helm Agent panel */}
      <div className="flex flex-col gap-4">
        {isPaid ? (
          <HelmChat
            artistData={artistData}
            messages={chatMessages}
            onSend={onSendChat}
            isStreaming={isChatStreaming}
          />
        ) : (
          // Pre-paid preview panel
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-[#1e1e1e]">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">H</span>
                </div>
                <span className="text-xs font-semibold text-white">Helm Agent</span>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">LOCKED</span>
            </div>
            <div className="p-3 flex flex-col gap-3">
              <div>
                <p className="text-[11px] text-zinc-500 mb-2">I&apos;ve analyzed {artistData.name}:</p>
                <div className="flex flex-col gap-1.5">
                  {analysis.completedItems.map((item, i) => (
                    <div key={i} className="flex gap-2 text-xs text-zinc-300">
                      <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-zinc-500 mb-2">Here&apos;s what I&apos;ll execute:</p>
                <div className="flex flex-col gap-1.5">
                  {analysis.tasks.map((task, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-zinc-600 shrink-0 font-mono mt-0.5">{i+1}.</span>
                      <span className="text-white font-medium">{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#0d0d0d] rounded-xl p-3 border border-[#1e1e1e]">
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 overflow-hidden">{analysis.narrative}</p>
              </div>
              <button
                onClick={onSubscribe}
                className="w-full text-center px-4 py-3 rounded-xl text-sm font-semibold text-white hover:scale-[1.02] transition-transform"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
              >
                Start 3-Day Free Trial →
              </button>
              <p className="text-[10px] text-zinc-600 text-center -mt-1">$49/mo after trial · Cancel anytime</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WORKS & RECORDINGS TAB ──────────────────────────────────────────────────
function WorksTab({
  artist, isPaid, onSubscribe, onSendChat, onRoyaltyAudit,
}: {
  artist: ArtistData;
  isPaid: boolean;
  onSubscribe: () => void;
  onSendChat: (text: string) => void;
  onRoyaltyAudit: () => void;
}) {
  const releases = artist.allReleases || [];
  const btn = (label: string, msg: string) => (
    <button
      onClick={() => isPaid ? onSendChat(msg) : onSubscribe()}
      className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#1e1e1e] hover:bg-[#2e2e2e] transition-colors"
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-white">Works & Recordings</h2>
          <p className="text-sm text-zinc-500 mt-1">{releases.length} releases found on Spotify</p>
        </div>
        <div className="flex gap-2">
          {btn("📋 Capture Song Splits", `Let's capture song splits for ${artist.name}'s catalog. Walk me through the ownership splits for all ${releases.length} releases — who owns what percentage of publishing and master rights.`)}
          <button
            onClick={() => isPaid ? onRoyaltyAudit() : onSubscribe()}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#1e1e1e] hover:bg-[#2e2e2e] transition-colors"
          >
            🔍 Run Royalty Audit
          </button>
        </div>
      </div>

      <div className={`border rounded-xl p-4 flex items-start gap-3 ${isPaid ? "bg-[#0d1a12] border-emerald-500/30" : "bg-[#111] border-[#1e1e1e]"}`}>
        <span className="text-xl mt-0.5">💰</span>
        <div>
          <p className={`text-sm font-semibold mb-1 ${isPaid ? "text-emerald-400" : "text-white"}`}>Royalty Audit {isPaid ? "Available" : "— Activate to Run"}</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Helm will compare your top {Math.min(10, releases.length)} recordings against ASCAP/BMI,
            the MLC, and SoundExchange to find unregistered works. Any gaps = Helm enrolls them through
            <strong className="text-white"> Good Morning Publishing Admin + Distribution</strong> with your approval.
          </p>
          <button
            onClick={() => isPaid ? onRoyaltyAudit() : onSubscribe()}
            className={`inline-block mt-2 text-xs font-semibold transition-colors ${isPaid ? "text-emerald-400 hover:text-emerald-300" : "text-[#6366f1] hover:text-[#818cf8]"}`}
          >
            {isPaid ? "Start audit →" : "Activate to start →"}
          </button>
        </div>
      </div>

      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2 border-b border-[#1e1e1e] text-[10px] text-zinc-500 uppercase tracking-wider">
          <span></span><span>Title</span><span>Type</span><span>Released</span><span>Tracks</span>
        </div>
        <div className="divide-y divide-[#1a1a1a]">
          {releases.map((r, i) => (
            <div key={r.id || i} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 hover:bg-[#141414] transition-colors">
              {r.albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.albumArt} alt={r.name} className="w-9 h-9 rounded-md object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-md bg-[#1a1a1a] flex items-center justify-center text-sm">💿</div>
              )}
              <div className="min-w-0">
                <a href={r.spotifyUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:text-[#a5b4fc] transition-colors truncate block">{r.name}</a>
              </div>
              <span className="text-[10px] capitalize text-zinc-500 bg-[#1e1e1e] px-2 py-0.5 rounded">{r.type}</span>
              <span className="text-xs text-zinc-500">{r.releaseDate}</span>
              <span className="text-xs text-zinc-500 text-right">{r.totalTracks}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── RELEASE MARKETING TAB ───────────────────────────────────────────────────
function ReleaseMarketingTab({
  artist, isPaid, onSubscribe, onSendChat,
}: {
  artist: ArtistData;
  isPaid: boolean;
  onSubscribe: () => void;
  onSendChat: (text: string) => void;
}) {
  const items = [
    { icon: "🔗", title: "Pre-Save Campaign",       desc: "Create a pre-save link and run fan engagement before release day",                                                          msg: "Help me set up a pre-save campaign for my next release. What platform should I use, how do I set it up, and how do I promote it to maximize pre-saves?" },
    { icon: "📰", title: "Pitch Journalists",         desc: "Find real music journalists covering your genre and pitch your latest single or album",                                      msg: `Find 15 music journalists and editors who actively cover ${(artist.genres||[])[0]||"indie"} artists like ${artist.name}. For each journalist include: their name, publication, recent article they wrote, their email or contact method, and why ${artist.name}'s latest release is a fit for them. Then write a personalized pitch template I can use for each.` },
    { icon: "📣", title: "Press & Playlist Outreach",desc: "Pitch 10 journalists and 50 playlist curators in your genre 4 weeks out",                                                      msg: `Build a press and playlist outreach plan for ${artist.name}. I need: 10 journalist targets, 50 playlist curator targets in the ${(artist.genres||[])[0]||"my"} genre, and a pitch template for each.` },
    { icon: "📄", title: "Press Release",            desc: "Draft and distribute a press release to genre-specific music blogs",                                                          msg: `Write a press release for ${artist.name}'s most recent release and tell me how to distribute it to the right music blogs.` },
    { icon: "📱", title: "Social Content Plan",      desc: "30-day content calendar built around your release date and story",                                                            msg: `Build a 30-day social content calendar for ${artist.name} around a release campaign. Include post ideas, formats (Reels/TikTok/Story), and optimal posting times.` },
    { icon: "📣", title: "Fan Acquisition Ads",      desc: "Run Meta/Instagram ads to grow your audience before release",                                                                msg: `Help me set up Meta/Instagram fan acquisition ads for ${artist.name}. What audience targeting, budget allocation, and ad creative do you recommend?` },
    { icon: "🎤", title: "Editorial Playlist Pitch", desc: `Submit to Spotify editorial for ${artist.name}'s next release`,                                                              msg: `Walk me through submitting ${artist.name}'s next release to Spotify editorial playlists. What do I need, when should I submit, and how do I write the pitch?` },
    { icon: "📺", title: "YouTube Premiere",         desc: "Set up a YouTube premiere + community post strategy",                                                                         msg: `Help me set up a YouTube premiere for ${artist.name}'s next release. What do I need to prepare, how do I build anticipation, and what community posts should I make?` },
    { icon: "🎙️", title: "Podcast Pitch",            desc: "Find 10 music podcasts in your genre and pitch a story",                                                                     msg: `Find 10 music podcasts relevant to ${artist.name}'s genre (${(artist.genres||[])[0]||"indie music"}) and write a pitch template I can use to get featured.` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-white">Release Marketing</h2>
        <p className="text-sm text-zinc-500 mt-1">Full-service campaign management for your next drop</p>
        {isPaid && <p className="text-xs text-emerald-400 mt-1">✓ All features active — click any to start</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <button
            key={item.title}
            onClick={() => isPaid ? onSendChat(item.msg) : onSubscribe()}
            className="flex items-start gap-3 p-4 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#6366f1]/40 hover:bg-[#12121a] transition-all text-left"
          >
            <span className="text-xl shrink-0">{item.icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  isPaid ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700/40 text-zinc-500"
                }`}>{isPaid ? "Active" : "Locked"}</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-[#1a1500] border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-amber-400 mb-1">Editorial Playlist Timing</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Helm will only pitch Spotify editorial if you have an upcoming release at least <strong className="text-white">4 weeks out</strong>.
            Pitching too late (or after release) wastes your shot. Plan your campaigns early.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── LINKS TAB ────────────────────────────────────────────────────────────────
function artistSlugFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function LinksTab({
  artist, isPaid, onSendChat,
}: {
  artist: ArtistData;
  isPaid: boolean;
  onSendChat: (text: string) => void;
}) {
  const [copiedLinks, setCopiedLinks] = useState<string | null>(null);
  const [copiedOneSheet, setCopiedOneSheet] = useState(false);
  const [published, setPublished] = useState<boolean | null>(null);

  const slug = artistSlugFromName(artist.name);
  const linksUrl = `https://helmos.co/links/${slug}`;
  const onesheetUrl = `https://helmos.co/${slug}`;

  // Check if one-sheet is published
  useEffect(() => {
    fetch(`/api/helm/onesheet/${slug}`)
      .then(r => { setPublished(r.ok); })
      .catch(() => setPublished(false));
  }, [slug]);

  const copyToClipboard = (text: string, which: "links" | "onesheet") => {
    navigator.clipboard.writeText(text).catch(() => {});
    if (which === "links") {
      setCopiedLinks("Copied!");
      setTimeout(() => setCopiedLinks(null), 2000);
    } else {
      setCopiedOneSheet(true);
      setTimeout(() => setCopiedOneSheet(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl flex flex-col gap-6">

      {/* Links Page card */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Your Links Page</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Share one link to everything</p>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">LIVE</span>
        </div>
        <div className="flex items-center gap-2 p-3 bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg mb-3">
          <span className="text-xs text-zinc-400 flex-1 truncate">{linksUrl}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => copyToClipboard(linksUrl, "links")}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              copiedLinks ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1e1e1e] text-zinc-300 hover:bg-[#2e2e2e]"
            }`}
          >
            {copiedLinks ?? "Copy Link"}
          </button>
          <a
            href={linksUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#1e1e1e] text-zinc-300 hover:bg-[#2e2e2e] transition-colors text-center"
          >
            Preview →
          </a>
        </div>
      </div>

      {/* One-Sheet card */}
      <div className={`rounded-xl p-5 border ${published ? "bg-[#111] border-[#1e1e1e]" : "border-dashed border-[#2e2e2e] bg-[#0d0d0d]"}`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Your One-Sheet</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Public artist profile page</p>
          </div>
          {published && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">PUBLISHED</span>
          )}
        </div>

        {published ? (
          <>
            <div className="flex items-center gap-2 p-3 bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg mb-3">
              <span className="text-xs text-zinc-400 flex-1 truncate">{onesheetUrl}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(onesheetUrl, "onesheet")}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  copiedOneSheet ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1e1e1e] text-zinc-300 hover:bg-[#2e2e2e]"
                }`}
              >
                {copiedOneSheet ? "Copied!" : "Copy Link"}
              </button>
              <a
                href={onesheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#1e1e1e] text-zinc-300 hover:bg-[#2e2e2e] transition-colors text-center"
              >
                View →
              </a>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-center py-4">
              <p className="text-2xl mb-2">📄</p>
              <p className="text-sm font-semibold text-white mb-1">Create Your One-Sheet</p>
              <p className="text-xs text-zinc-500">Generate your artist profile page at helmos.co/{slug}</p>
            </div>
            <button
              onClick={() => onSendChat(`Generate and publish my artist one-sheet page at helmos.co/${slug}. Use my Spotify data to fill in bio, top tracks, latest release, and social links.`)}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] transition-colors"
            >
              Generate One-Sheet →
            </button>
          </div>
        )}
      </div>

      {/* Pub Admin Referral card */}
      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl shrink-0">🎼</span>
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Free Publishing Administration</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Let Good Morning Music handle your publishing. We register your works everywhere,
              collect royalties from every source, and take only 15% of what we collect.
              No setup fees. No monthly fees. Quit anytime.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {["ASCAP/BMI registration", "MLC enrollment", "SoundExchange", "International"].map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {tag}
            </span>
          ))}
        </div>
        <a
          href="https://goodmornmusic.com/pub-admin?ref=helm"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
        >
          Apply for Free Pub Admin →
        </a>
      </div>

    </div>
  );
}


// ─── OUTREACH TAB ─────────────────────────────────────────────────────────────
function OutreachTab({ artist, isPaid, onSubscribe }: {
  artist: ArtistData;
  isPaid: boolean;
  onSubscribe: () => void;
}) {
  const slug = toSlug(artist.name);
  const email = artistEmail(slug);

  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [history, setHistory] = useState<OutreachRecord[]>([]);
  const [inbox, setInbox] = useState<InboundEmail[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [replyModal, setReplyModal] = useState<InboundEmail | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySending, setReplySending] = useState(false);

  // Load history + inbox on mount
  useEffect(() => {
    if (!isPaid) return;
    Promise.all([
      fetch(`/api/helm/outreach/history?artistId=${artist.id}`).then(r => r.json()),
      fetch(`/api/helm/outreach/inbox?artistSlug=${encodeURIComponent(slug)}`).then(r => r.json()),
    ]).then(([histData, inboxData]) => {
      setHistory(histData.records ?? []);
      setInbox(inboxData.emails ?? []);
      setHistoryLoaded(true);
    }).catch(() => setHistoryLoaded(true));
  }, [artist.id, slug, isPaid]);

  const handleCopy = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async (count: number) => {
    if (!isPaid) { onSubscribe(); return; }
    setGenerating(true);
    setDrafts([]);
    setSendResult(null);
    try {
      const res = await fetch("/api/helm/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistData: artist, count }),
      });
      const data = await res.json();
      if (data.drafts) {
        setDrafts(data.drafts);
        setSelected(new Set(data.drafts.map((_: OutreachDraft, i: number) => i)));
      }
    } catch (e) {
      console.error("Generate error:", e);
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleSendSelected = async () => {
    if (!isPaid) { onSubscribe(); return; }
    const toSend = drafts.filter((_, i) => selected.has(i));
    if (toSend.length === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/helm/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId: artist.id, artistName: artist.name, drafts: toSend }),
      });
      const data = await res.json();
      setSendResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
      setDrafts([]);
      setSelected(new Set());
      // Refresh history
      fetch(`/api/helm/outreach/history?artistId=${artist.id}`)
        .then(r => r.json())
        .then(d => setHistory(d.records ?? []))
        .catch(() => {});
    } catch (e) {
      console.error("Send error:", e);
    } finally {
      setSending(false);
    }
  };

  const handleReply = async () => {
    if (!replyModal) return;
    setReplySending(true);
    try {
      await fetch("/api/helm/outreach/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistSlug: slug,
          to: replyModal.from,
          subject: replyModal.subject.startsWith("Re:") ? replyModal.subject : `Re: ${replyModal.subject}`,
          body: replyBody,
          inReplyToId: replyModal.inReplyTo,
        }),
      });
      setReplyModal(null);
      setReplyBody("");
    } catch (e) {
      console.error("Reply error:", e);
    } finally {
      setReplySending(false);
    }
  };

  const roleColors: Record<string, string> = {
    "Journalist": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "Playlist Curator": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "Booking Agent": "bg-teal-500/20 text-teal-400 border-teal-500/30",
    "Music Supervisor": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "Radio DJ": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  };

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      {/* Reply modal */}
      {replyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setReplyModal(null)}>
          <div className="w-full max-w-lg bg-[#0e0e0e] border border-[#2e2e2e] rounded-2xl flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e1e1e]">
              <h3 className="text-sm font-semibold text-white">Reply to {replyModal.fromName || replyModal.from}</h3>
              <button onClick={() => setReplyModal(null)} className="text-zinc-500 hover:text-white transition-colors text-sm">✕</button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-3">
                <p className="text-[10px] text-zinc-500 mb-1">Original message</p>
                <p className="text-xs text-zinc-400 line-clamp-3">{replyModal.text}</p>
              </div>
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Type your reply..."
                rows={6}
                className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg p-3 text-xs text-white placeholder-zinc-600 outline-none focus:border-[#6366f1]/50 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setReplyModal(null)} className="px-4 py-2 rounded-lg text-xs text-zinc-400 bg-[#1e1e1e] hover:bg-[#2e2e2e] transition-colors">Cancel</button>
                <button
                  onClick={handleReply}
                  disabled={replySending || !replyBody.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] transition-colors disabled:opacity-50"
                >
                  {replySending ? "Sending…" : `Send from ${email}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Your outreach address */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Your Outreach Address</p>
        <div className="flex items-center gap-3">
          <span className="text-lg">📧</span>
          <span className="text-base font-semibold text-white font-mono">{email}</span>
          <button
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${copied ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1e1e1e] text-zinc-300 hover:bg-[#2e2e2e]"}`}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">Outreach is sent from this address. Replies arrive in your inbox below.</p>
      </div>

      {/* Generate section */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white mb-1">Generate Outreach</h2>
          <p className="text-xs text-zinc-500">Helm will research and draft up to 10 personalized emails per day targeting journalists, playlist curators, and booking agents in your genre.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[3, 5, 10].map(n => (
            <button
              key={n}
              onClick={() => handleGenerate(n)}
              disabled={generating}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] disabled:opacity-50 transition-colors"
            >
              {generating ? "Researching…" : `Generate ${n} Emails →`}
            </button>
          ))}
        </div>

        {/* Generating state */}
        {generating && (
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center animate-pulse">
              <span className="text-sm font-bold text-white">H</span>
            </div>
            <p className="text-xs text-zinc-400">Researching targets for {artist.name}…</p>
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"
                  style={{ animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* Send result */}
        {sendResult && (
          <div className={`rounded-xl p-4 border text-sm font-medium ${sendResult.sent > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
            {sendResult.sent > 0 && `✓ ${sendResult.sent} email${sendResult.sent !== 1 ? "s" : ""} sent`}
            {sendResult.failed > 0 && ` · ${sendResult.failed} failed`}
          </div>
        )}
      </div>

      {/* Drafts review */}
      {drafts.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{drafts.length} Draft{drafts.length !== 1 ? "s" : ""} Ready</h2>
            <span className="text-xs text-zinc-500">{selected.size} selected</span>
          </div>
          <div className="flex flex-col gap-3">
            {drafts.map((draft, i) => (
              <div
                key={i}
                className={`bg-[#111] border rounded-xl p-4 transition-colors cursor-pointer ${selected.has(i) ? "border-[#6366f1]/40 bg-[#12121a]" : "border-[#1e1e1e]"}`}
                onClick={() => toggleSelect(i)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${selected.has(i) ? "bg-[#6366f1] border-[#6366f1]" : "border-zinc-600"}`}>
                    {selected.has(i) && <span className="text-[8px] text-white font-bold">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-white">{draft.toName}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${roleColors[draft.toRole] || "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"}`}>
                        {draft.toRole}
                      </span>
                      {draft.toPublication && (
                        <span className="text-[11px] text-zinc-500">{draft.toPublication}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mb-2 italic">{draft.rationale}</p>
                    <p className="text-xs text-zinc-300 font-medium mb-1">Subject: {draft.subject}</p>
                    <p className="text-xs text-zinc-500">{draft.body.slice(0, 120)}{draft.body.length > 120 ? "…" : ""}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">To: {draft.to}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleSendSelected}
            disabled={sending || selected.size === 0}
            className="self-start px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] disabled:opacity-50 transition-colors"
          >
            {sending ? "Sending…" : `Send ${selected.size} Selected →`}
          </button>
        </div>
      )}

      {/* Sent history */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white">Sent History</h2>
        {!historyLoaded ? (
          <p className="text-xs text-zinc-500">Loading…</p>
        ) : history.length === 0 ? (
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 text-center">
            <p className="text-xs text-zinc-500">No emails sent yet. Generate and send your first outreach above.</p>
          </div>
        ) : (
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_2fr_auto] gap-4 px-4 py-2 border-b border-[#1e1e1e] text-[10px] text-zinc-500 uppercase tracking-wider">
              <span>Date</span><span>To</span><span>Subject</span><span>Status</span>
            </div>
            <div className="divide-y divide-[#1a1a1a]">
              {history.map(record => (
                <div key={record.id} className="grid grid-cols-[1fr_1fr_2fr_auto] gap-4 items-center px-4 py-3 hover:bg-[#141414] transition-colors">
                  <span className="text-[11px] text-zinc-500">{new Date(record.sentAt).toLocaleDateString()}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{record.toName}</p>
                    <p className="text-[10px] text-zinc-600 truncate">{record.to}</p>
                  </div>
                  <p className="text-xs text-zinc-400 truncate">{record.subject}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${record.status === "sent" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    {record.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inbox / replies */}
      {inbox.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-white">Replies <span className="text-zinc-500 font-normal">({inbox.length})</span></h2>
          <div className="flex flex-col gap-3">
            {inbox.map(msg => (
              <div key={msg.id} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 hover:border-[#2e2e2e] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{msg.fromName || msg.from}</span>
                      <span className="text-[10px] text-zinc-600">{new Date(msg.receivedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-zinc-300 font-medium mb-1">{msg.subject}</p>
                    <p className="text-xs text-zinc-500 line-clamp-2">{msg.text}</p>
                  </div>
                  <button
                    onClick={() => { setReplyModal(msg); setReplyBody(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1e1e1e] hover:bg-[#2e2e2e] transition-colors shrink-0"
                  >
                    Reply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────────────────────
function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const artistId = searchParams.get("artist");
  const mode = searchParams.get("mode"); // "queue" = agent queue view

  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [phase, setPhase] = useState<"loading-artist" | "loading-analysis" | "done" | "error">("loading-artist");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "works" | "release" | "links" | "outreach">("overview");

  // Auth / paid state
  const [isPaid, setIsPaid] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatStreaming, setIsChatStreaming] = useState(false);

  // Document modal
  const [docModal, setDocModal] = useState<{ content: string; title: string } | null>(null);
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);

  // Paid media modal
  const [showPaidMedia, setShowPaidMedia] = useState(false);

  // Check paid status on load
  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(d => { if (d.authenticated) setIsPaid(true); })
      .catch(() => {});
  }, []);

  // Subscribe handler — creates Stripe Checkout Session
  const handleSubscribe = useCallback(async () => {
    if (!artistId || isSubscribing) return;
    setIsSubscribing(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else console.error("No checkout URL", data);
    } catch (e) {
      console.error("Checkout error", e);
    } finally {
      setIsSubscribing(false);
    }
  }, [artistId, isSubscribing]);

  // Chat handler — streams from Claude
  const handleSendChat = useCallback(async (text: string) => {
    if (!artistData || isChatStreaming) return;

    // Switch to overview tab so user can see the chat
    setActiveTab("overview");

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setIsChatStreaming(true);

    try {
      const res = await fetch("/api/helm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          artistContext: artistData,
        }),
      });

      if (!res.ok) {
        setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I had trouble responding. Please try again." }]);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add empty assistant message that we'll stream into
      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantContent };
          return updated;
        });
      }

      // Check for generate trigger in response
      const genMatch = assistantContent.match(/<generate\s+type="([^"]+)"\s*\/>/);
      if (genMatch) {
        const docType = genMatch[1] as DocType;
        // Remove the tag from display
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantContent.replace(/<generate[^/]*\/>/g, "").trim(),
          };
          return updated;
        });
        // Auto-generate
        setTimeout(() => handleGenerateDoc(docType), 500);
      }
    } finally {
      setIsChatStreaming(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistData, chatMessages, isChatStreaming]);

  // Royalty audit handler — streams real database search results
  const handleRoyaltyAudit = useCallback(async () => {
    if (!artistData || isChatStreaming) return;

    setActiveTab("overview");

    const userMsg: ChatMessage = { role: "user", content: "Run a royalty audit on my catalog" };
    setChatMessages(prev => [...prev, userMsg]);
    setIsChatStreaming(true);

    // Add placeholder message
    setChatMessages(prev => [...prev, { role: "assistant", content: "Running your royalty audit now. Searching The MLC, ASCAP, and BMI... \u23F3" }]);

    const trackNames = [
      ...artistData.allReleases.slice(0, 10).map(r => r.name),
      ...artistData.topTracks.slice(0, 10).map(t => t.name),
    ].filter((name, i, arr) => arr.indexOf(name) === i).slice(0, 10);

    try {
      const res = await fetch("/api/helm/royalty-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistName: artistData.name,
          tracks: trackNames,
          monthlyListeners: artistData.monthlyListeners,
        }),
      });

      if (!res.ok) {
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "Sorry, the royalty audit failed. Please try again." };
          return updated;
        });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let content = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content };
          return updated;
        });
      }
    } finally {
      setIsChatStreaming(false);
    }
  }, [artistData, isChatStreaming]);

  // Document generation handler
  const handleGenerateDoc = useCallback(async (type: DocType) => {
    if (!artistData) return;
    const titles: Record<DocType, string> = {
      "one-sheet": "Artist One-Sheet",
      "bio": "Artist Bio",
      "press-release": "Press Release",
      "pitch-email": "Playlist Pitch Email",
    };
    setGeneratingDoc(titles[type]);

    try {
      const res = await fetch("/api/helm/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, artistData }),
      });
      const data = await res.json();
      if (data.content) {
        setDocModal({ content: data.content, title: titles[type] });
      }
    } catch (e) {
      console.error("Generate error", e);
    } finally {
      setGeneratingDoc(null);
    }
  }, [artistData]);

  const loadDashboard = useCallback(async () => {
    if (!artistId) { router.push("/"); return; }
    try {
      setPhase("loading-artist");
      const artistRes = await fetch(`/api/artist?spotifyUrl=spotify:artist:${artistId}`);
      const artist = await artistRes.json();
      if (!artistRes.ok) { setErrorMsg(artist.error || "Failed to load artist"); setPhase("error"); return; }
      setArtistData(artist);
      setPhase("loading-analysis");
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(artist),
      });
      const analysisData = await analyzeRes.json();
      if (!analyzeRes.ok) { setErrorMsg(analysisData.error || "Failed to analyze artist"); setPhase("error"); return; }
      setAnalysis(analysisData);
      setPhase("done");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setPhase("error");
    }
  }, [artistId, router]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (phase === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-[#0a0a0a]">
        <div className="text-center flex flex-col gap-3">
          <p className="text-4xl">😕</p>
          <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
          <p className="text-zinc-400 text-sm">{errorMsg}</p>
        </div>
        <button onClick={() => router.push("/")} className="px-6 py-3 rounded-xl text-sm font-medium text-white bg-[#6366f1]">
          Try another artist
        </button>
      </div>
    );
  }

  if (phase !== "done" || !artistData || !analysis) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center animate-pulse">
            <span className="text-xl font-bold text-white">H</span>
          </div>
          <p className="text-white font-medium">
            {phase === "loading-artist" ? "Scanning Spotify profile..." : "Building your career plan..."}
          </p>
          <p className="text-zinc-500 text-sm">
            {phase === "loading-analysis" ? "Helm is analyzing your career data" : "Fetching artist profile"}
          </p>
          <div className="flex gap-1.5 mt-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"
                style={{ animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(.8);opacity:.5} 40%{transform:scale(1.2);opacity:1} }`}</style>
      </div>
    );
  }

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "works",    label: `Works & Recordings (${artistData.allReleases.length})` },
    { id: "release",  label: "Release Marketing" },
    { id: "links",    label: "🔗 Links" },
    { id: "outreach",  label: "📧 Outreach" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Doc modal */}
      {docModal && (
        <DocModal content={docModal.content} title={docModal.title} onClose={() => setDocModal(null)} />
      )}

      {/* Paid media modal */}
      {showPaidMedia && artistData && (
        <PaidMediaModal artistData={artistData} onClose={() => setShowPaidMedia(false)} />
      )}

      {/* Generating overlay */}
      {generatingDoc && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#2e2e2e] rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center animate-pulse">
              <span className="text-base font-bold text-white">H</span>
            </div>
            <p className="text-sm text-white font-medium">Generating {generatingDoc}…</p>
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"
                  style={{ animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="border-b border-[#1a1a1a] px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-xs font-bold text-white">H</span>
            </div>
            <span className="text-sm font-semibold text-white">Helm</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPaidMedia(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-violet-600/80 hover:bg-violet-600 border border-violet-500/30 transition-colors"
            >
              🎯 Buy Paid Media
            </button>
            {isPaid ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-400 font-medium">⚡ Active</span>
                <span className="hidden sm:block text-xs text-zinc-500">{analysis.topOpportunity}</span>
              </div>
            ) : (
              <>
                <span className="hidden sm:block text-xs text-zinc-500 max-w-[240px] truncate">{analysis.topOpportunity}</span>
                <button
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] transition-colors disabled:opacity-60"
                >
                  {isSubscribing ? "Loading…" : "Start Free Trial · $49/mo"}
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Artist header + tabs */}
      <div className="border-b border-[#1a1a1a] px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 py-4">
            {artistData.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artistData.image} alt={artistData.name} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/10 shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center shrink-0 text-xl">🎵</div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white">{artistData.name}</h1>
              <div className="flex items-center gap-3 flex-wrap mt-0.5">
                {artistData.genres.slice(0,3).map(g => (
                  <span key={g} className="text-[11px] text-zinc-500">{g}</span>
                ))}
                <span className="text-[11px] text-zinc-600">·</span>
                <span className="text-[11px] text-zinc-500">{artistData.monthlyListeners} listeners</span>
                <span className="text-[11px] text-zinc-600">·</span>
                <span className="text-[11px] text-zinc-500">Spotify {artistData.spotifyPopularity}/100</span>
              </div>
            </div>
            {artistData.topSong && (
              <div className="hidden sm:flex items-center gap-2 ml-auto shrink-0 bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2">
                {artistData.topSong.albumArt && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={artistData.topSong.albumArt} alt="" className="w-7 h-7 rounded object-cover" />
                )}
                <div>
                  <p className="text-xs font-medium text-white">{artistData.topSong.name}</p>
                  <p className="text-[10px] text-zinc-500">~{artistData.topSong.streamEstimate} streams</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? "text-white bg-[#111] border-t border-l border-r border-[#1e1e1e] -mb-px"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {mode === "queue" && artistData && (
          <div className="max-w-2xl mx-auto">
            <QueueDashboard
              artistId={artistData.id}
              artistName={artistData.name}
              artistImage={artistData.image}
              isPaid={isPaid}
              onUpgrade={handleSubscribe}
            />
            <div className="mt-6 pt-6 border-t border-[#1a1a1a]">
              <button
                onClick={() => { const url = new URL(window.location.href); url.searchParams.delete("mode"); router.push(url.pathname + url.search); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                ← Back to full analysis
              </button>
            </div>
          </div>
        )}
        {mode !== "queue" && activeTab === "overview" && (
          <OverviewTab
            artistData={artistData}
            analysis={analysis}
            isPaid={isPaid}
            onSubscribe={handleSubscribe}
            onSendChat={handleSendChat}
            onGenerate={handleGenerateDoc}
            onRoyaltyAudit={handleRoyaltyAudit}
            chatMessages={chatMessages}
            isChatStreaming={isChatStreaming}
          />
        )}
        {mode !== "queue" && activeTab === "works" && (
          <WorksTab
            artist={artistData}
            isPaid={isPaid}
            onSubscribe={handleSubscribe}
            onSendChat={(msg) => { handleSendChat(msg); setActiveTab("overview"); }}
            onRoyaltyAudit={() => { handleRoyaltyAudit(); setActiveTab("overview"); }}
          />
        )}
        {mode !== "queue" && activeTab === "release" && (
          <ReleaseMarketingTab
            artist={artistData}
            isPaid={isPaid}
            onSubscribe={handleSubscribe}
            onSendChat={(msg) => { handleSendChat(msg); setActiveTab("overview"); }}
          />
        )}
        {mode !== "queue" && activeTab === "links" && (
          <LinksTab
            artist={artistData}
            isPaid={isPaid}
            onSendChat={handleSendChat}
          />
        )}
        {mode !== "queue" && activeTab === "outreach" && (
          <OutreachTab
            artist={artistData}
            isPaid={isPaid}
            onSubscribe={handleSubscribe}
          />
        )}
      </div>

      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(.8);opacity:.5} 40%{transform:scale(1.2);opacity:1} }`}</style>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center animate-pulse">
          <span className="text-lg font-bold text-white">H</span>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
