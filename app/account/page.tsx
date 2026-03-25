"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface NotificationPrefs {
  dailyDigest: boolean;
  weeklyGrowth: boolean;
}

interface ProfileData {
  displayName: string;
  notificationPrefs: NotificationPrefs;
}

interface StripeSubscription {
  status: string;
  plan: string;
  interval: string;
  amount: number;
  currentPeriodEnd: number | null;
  trialEnd: number | null;
}

interface AccountData {
  email: string;
  profile: ProfileData;
  subscription: StripeSubscription | null;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function PlanBadge({ status }: { status: string }) {
  if (status === "active") {
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Active</span>;
  }
  if (status === "trialing") {
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">Trial</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-700/60 text-zinc-400 border border-zinc-600/30">Inactive</span>;
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const router = useRouter();

  // Data state
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile form state
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Notification prefs state
  const [notifDailyDigest, setNotifDailyDigest] = useState(true);
  const [notifWeeklyGrowth, setNotifWeeklyGrowth] = useState(false);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [notifsSaved, setNotifsSaved] = useState(false);

  // Billing portal state
  const [openingPortal, setOpeningPortal] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ─── FETCH SUBSCRIPTION FROM STRIPE ─────────────────────────────────────────
  const fetchSubscription = useCallback(async (customerId: string): Promise<StripeSubscription | null> => {
    try {
      const res = await fetch(`/api/stripe/subscription?customerId=${encodeURIComponent(customerId)}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }, []);

  // ─── LOAD ACCOUNT DATA ───────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        // Get session info (email is in session cookie, decoded server-side)
        const sessionRes = await fetch("/api/auth/session");
        if (!sessionRes.ok) {
          router.push("/");
          return;
        }
        const sessionData = await sessionRes.json() as { email: string; customerId: string };
        if (!sessionData.email) {
          router.push("/");
          return;
        }

        // Load profile + notifications
        const profileRes = await fetch("/api/account/profile");
        if (!profileRes.ok) {
          router.push("/");
          return;
        }
        const profileData = await profileRes.json() as ProfileData;

        // Load subscription info
        const sub = sessionData.customerId ? await fetchSubscription(sessionData.customerId) : null;

        setAccountData({
          email: sessionData.email,
          profile: profileData,
          subscription: sub,
        });
        setDisplayName(profileData.displayName);
        setNotifDailyDigest(profileData.notificationPrefs.dailyDigest);
        setNotifWeeklyGrowth(profileData.notificationPrefs.weeklyGrowth);
      } catch {
        setError("Failed to load account data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, fetchSubscription]);

  // ─── HANDLERS ────────────────────────────────────────────────────────────────
  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveNotifications() {
    setSavingNotifs(true);
    try {
      await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPrefs: { dailyDigest: notifDailyDigest, weeklyGrowth: notifWeeklyGrowth } }),
      });
      setNotifsSaved(true);
      setTimeout(() => setNotifsSaved(false), 2500);
    } finally {
      setSavingNotifs(false);
    }
  }

  async function handleManageBilling() {
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setOpeningPortal(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteText !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteText }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        router.push("/");
      } else {
        setDeleteError(data.error ?? "Failed to delete account.");
      }
    } catch {
      setDeleteError("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  // ─── RENDER STATES ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center animate-pulse">
          <span className="text-lg font-bold text-white">H</span>
        </div>
      </div>
    );
  }

  if (error || !accountData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-zinc-400 text-sm">{error ?? "Something went wrong."}</p>
      </div>
    );
  }

  const { email, subscription } = accountData;

  const planLabel = subscription
    ? subscription.status === "trialing"
      ? "Free Trial"
      : "Helmos Pro"
    : "No active subscription";

  const billingLabel = subscription
    ? subscription.interval === "year"
      ? "Annual ($278/yr)"
      : "Monthly ($29/mo)"
    : null;

  const isMonthly = subscription?.interval === "month" && subscription?.status === "active";

  // ─── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="border-b border-[#1a1a1a] px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-xs font-bold text-white">H</span>
            </div>
            <span className="text-sm font-semibold text-white">Helm</span>
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back to dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Account Settings</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage your profile, billing, and preferences.</p>
        </div>

        {/* ── SECTION: Profile ────────────────────────────────────────────── */}
        <section className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/60">
            <h2 className="text-sm font-semibold text-white">Profile</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Email</label>
              <div className="px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/40 text-sm text-zinc-400 select-all">
                {email}
              </div>
              <p className="text-[11px] text-zinc-600 mt-1">Email cannot be changed. Contact support if needed.</p>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/40 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#6366f1]/60 transition-colors"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  profileSaved
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/25"
                    : "bg-[#6366f1] hover:bg-[#5558e8] text-white disabled:opacity-60"
                }`}
              >
                {profileSaved ? "Saved ✓" : savingProfile ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </section>

        {/* ── SECTION: Subscription ───────────────────────────────────────── */}
        <section className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/60">
            <h2 className="text-sm font-semibold text-white">Subscription</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{planLabel}</p>
                {billingLabel && <p className="text-xs text-zinc-500 mt-0.5">{billingLabel}</p>}
              </div>
              {subscription && <PlanBadge status={subscription.status} />}
            </div>

            {subscription?.currentPeriodEnd && (
              <div className="flex items-center justify-between py-3 border-t border-zinc-800/40">
                <span className="text-xs text-zinc-500">
                  {subscription.status === "trialing" ? "Trial ends" : "Next billing date"}
                </span>
                <span className="text-xs text-zinc-300 font-medium">
                  {fmt(subscription.currentPeriodEnd)}
                </span>
              </div>
            )}

            {subscription?.trialEnd && subscription.status === "trialing" && (
              <div className="flex items-center justify-between py-3 border-t border-zinc-800/40">
                <span className="text-xs text-zinc-500">Trial end date</span>
                <span className="text-xs text-zinc-300 font-medium">{fmt(subscription.trialEnd)}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleManageBilling}
                disabled={openingPortal}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700/60 transition-colors disabled:opacity-60"
              >
                {openingPortal ? "Opening…" : "Manage Billing →"}
              </button>

              {isMonthly && (
                <a
                  href="https://helmos.co/upgrade/annual"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#6366f1]/15 hover:bg-[#6366f1]/25 text-[#818cf8] border border-[#6366f1]/25 transition-colors"
                >
                  Upgrade to Annual
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ── SECTION: Notifications ──────────────────────────────────────── */}
        <section className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/60">
            <h2 className="text-sm font-semibold text-white">Notifications</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <Toggle
              label="Daily opportunity digest"
              description="Get an email each morning with your top 3 new opportunities."
              enabled={notifDailyDigest}
              onToggle={() => setNotifDailyDigest(v => !v)}
            />
            <div className="border-t border-zinc-800/40 pt-4">
              <Toggle
                label="Weekly growth summary"
                description="A weekly recap of your career momentum and completed actions."
                enabled={notifWeeklyGrowth}
                onToggle={() => setNotifWeeklyGrowth(v => !v)}
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={handleSaveNotifications}
                disabled={savingNotifs}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  notifsSaved
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/25"
                    : "bg-[#6366f1] hover:bg-[#5558e8] text-white disabled:opacity-60"
                }`}
              >
                {notifsSaved ? "Saved ✓" : savingNotifs ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </div>
        </section>

        {/* ── SECTION: Danger Zone ────────────────────────────────────────── */}
        <section className="border border-red-900/40 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-red-900/40 bg-red-950/10">
            <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
          </div>
          <div className="px-6 py-5 bg-red-950/5">
            {!showDeleteConfirm ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Delete your account</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    This will cancel your subscription and permanently deactivate your account.
                    Your data will be retained for 30 days before purging.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold text-red-400 bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 transition-colors"
                >
                  Delete Account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-white font-medium">Are you sure?</p>
                <p className="text-xs text-zinc-500">
                  This action is irreversible. Type <span className="text-red-400 font-mono font-semibold">DELETE</span> to confirm.
                </p>
                <input
                  type="text"
                  value={deleteText}
                  onChange={e => setDeleteText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-red-800/50 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-600/60 transition-colors font-mono"
                />
                {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteText(""); setDeleteError(null); }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteText !== "DELETE" || deleting}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {deleting ? "Deleting…" : "Permanently Delete Account"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── TOGGLE COMPONENT ─────────────────────────────────────────────────────────
function Toggle({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={`relative shrink-0 mt-0.5 w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
          enabled ? "bg-[#6366f1]" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
