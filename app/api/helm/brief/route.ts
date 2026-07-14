// Daily Brief endpoint — assembles the "what's happening today" snapshot
// shown at the top of the dashboard. Pulls from the data Helm already has
// (inbox, outreach history, opportunities, one-sheet state, shows) and
// derives one ranked "suggested next action" so the user always has a
// clear next move when they log in.

import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";
import { getSoundExchangeCount, type SoundExchangeCount } from "@/lib/soundexchange";
import type { InboundEmail } from "@/app/api/helm/outreach/webhook/route";
import type { OutreachRecord } from "@/app/api/helm/outreach/send/route";
import type { UpcomingShow } from "@/lib/types";

export interface BriefSuggestedAction {
  label: string;
  detail: string;
  href?: string;          // internal route (e.g. "/dashboard?tab=outreach")
  mission?: string;       // outreach mission id for deep-link
  tab?: string;           // dashboard tab to switch to
}

export interface DailyBrief {
  artistId: string;
  artistName?: string;
  generatedAt: string;
  unreadInboxCount: number;
  sentToday: number;
  openOpportunities: number;
  lastOutreachAgeDays: number | null;
  hasOneSheet: boolean;
  hasBio: boolean;
  upcomingShowsCount: number;
  // Number of recordings SoundExchange has under this artist's name.
  // null = not yet checked / lookup failed. Cached for 7 days per artist
  // to keep dashboard load fast. Used to suggest the royalty audit.
  soundExchangeRegistered: number | null;
  suggested: BriefSuggestedAction;
}

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const artistId = req.nextUrl.searchParams.get("artistId");
  if (!artistId) {
    return new Response(JSON.stringify({ error: "artistId required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  const artistSlug = (req.nextUrl.searchParams.get("artistSlug") || "").toLowerCase();
  const artistName = req.nextUrl.searchParams.get("artistName") || "";

  // Pull all the small reads in parallel — plus the cached SoundExchange
  // count if we've looked it up before.
  const seCacheKey = `helm:artist:${artistId}:soundexchange:count`;
  const [
    inboxIds,
    outreachIds,
    onesheet,
    bio,
    showsRaw,
    opportunities,
    seCached,
  ] = await Promise.all([
    artistSlug ? kvGet<string[]>(`inbox-ids:${artistSlug}`).then(ids => ids ?? []) : Promise.resolve([] as string[]),
    kvGet<string[]>(`outreach-ids:${artistId}`).then(ids => ids ?? []),
    artistSlug ? kvGet<unknown>(`onesheet:${artistSlug}`) : Promise.resolve(null),
    kvGet<unknown>(`helm:artist:${artistId}:bio`),
    kvGet<UpcomingShow[]>(`helm:artist:${artistId}:upcoming-shows`),
    kvGet<{ status?: string }[]>(`helm:user:${session.email}:opportunities`),
    kvGet<SoundExchangeCount>(seCacheKey),
  ]);

  // Unread inbox = inbound emails where `read !== true`. Pull only the latest
  // ~50 to keep this fast even on noisy accounts.
  const recentInboxIds = inboxIds.slice(-50);
  const inboxItems = await Promise.all(
    recentInboxIds.map(id => kvGet<InboundEmail>(`inbox:${artistSlug}:${id}`))
  );
  const unreadInboxCount = inboxItems.filter(m => m && !m.read).length;

  // Pull the latest ~50 outreach records — enough to compute "sent today"
  // and "days since last outreach."
  const recentOutreachIds = outreachIds.slice(-50);
  const outreachItems = await Promise.all(
    recentOutreachIds.map(id => kvGet<OutreachRecord>(`outreach:${artistId}:${id}`))
  );
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = outreachItems.filter(o =>
    o && o.status === "sent" && (o.sentAt || "").slice(0, 10) === today
  ).length;
  const lastSent = outreachItems
    .filter((o): o is OutreachRecord => !!o && o.status === "sent")
    .map(o => new Date(o.sentAt).getTime())
    .sort((a, b) => b - a)[0];
  const lastOutreachAgeDays = lastSent
    ? Math.floor((Date.now() - lastSent) / (1000 * 60 * 60 * 24))
    : null;

  const upcomingShows = (showsRaw ?? []).filter(s => s.date >= today);
  const openOpportunities = (opportunities ?? []).filter(
    o => o.status === "new" || o.status === "approved"
  ).length;

  // SoundExchange count: prefer cached; if missing AND artistName is
  // known, do a live lookup and cache for 7 days. On timeout/error we
  // return null and try again next brief pull.
  let soundExchangeRegistered: number | null = null;
  if (seCached && typeof seCached.count === "number") {
    soundExchangeRegistered = seCached.count;
  } else if (artistName) {
    const live = await getSoundExchangeCount(artistName);
    if (live !== null) {
      soundExchangeRegistered = live;
      await kvSet(
        seCacheKey,
        { count: live, checkedAt: new Date().toISOString() } as SoundExchangeCount,
        60 * 60 * 24 * 7
      );
    }
  }

  const suggested = pickSuggestedAction({
    unreadInboxCount,
    openOpportunities,
    lastOutreachAgeDays,
    hasOneSheet: !!onesheet,
    hasBio: !!bio,
    upcomingShowsCount: upcomingShows.length,
    soundExchangeRegistered,
  });

  const brief: DailyBrief = {
    artistId,
    generatedAt: new Date().toISOString(),
    unreadInboxCount,
    sentToday,
    openOpportunities,
    lastOutreachAgeDays,
    hasOneSheet: !!onesheet,
    hasBio: !!bio,
    upcomingShowsCount: upcomingShows.length,
    soundExchangeRegistered,
    suggested,
  };

  return new Response(JSON.stringify(brief), {
    headers: { "Content-Type": "application/json" },
  });
}

// Rule-ordered: the FIRST condition that fires wins. Order matters —
// the most urgent / highest-leverage action goes first.
function pickSuggestedAction(s: {
  unreadInboxCount: number;
  openOpportunities: number;
  lastOutreachAgeDays: number | null;
  hasOneSheet: boolean;
  hasBio: boolean;
  upcomingShowsCount: number;
  soundExchangeRegistered: number | null;
}): BriefSuggestedAction {
  if (s.unreadInboxCount > 0) {
    return {
      label: `Reply to ${s.unreadInboxCount} new message${s.unreadInboxCount === 1 ? "" : "s"}`,
      detail: "Someone responded to your outreach — keep the conversation warm.",
      tab: "outreach",
    };
  }
  if (!s.hasBio) {
    return {
      label: "Write your artist bio",
      detail: "Helm runs a 5-question interview and saves three lengths you can use anywhere.",
      tab: "overview", // bio is created from chat in Overview
    };
  }
  if (!s.hasOneSheet) {
    return {
      label: "Publish your one-sheet",
      detail: "A real helmos.co/{you} page for press and bookings — ~30 seconds to generate.",
      tab: "overview",
    };
  }
  // "Hidden money" — surface unclaimed royalty exposure once foundation is
  // in place. Ranked above cold-start outreach because there's a real
  // dollar figure attached and it only fires when we've confirmed the
  // artist actually has SoundExchange registrations.
  if (s.soundExchangeRegistered !== null && s.soundExchangeRegistered > 0) {
    return {
      label: `Run your royalty audit — ${s.soundExchangeRegistered} SoundExchange registration${s.soundExchangeRegistered === 1 ? "" : "s"}`,
      detail: "Verified recordings sitting in the SoundExchange registry. Helm cross-checks them against your catalog to flag anything unclaimed.",
      tab: "ai-tools",
    };
  }
  if (s.lastOutreachAgeDays === null || s.lastOutreachAgeDays >= 7) {
    return {
      label: "Pitch press this morning",
      detail: "10 verified contacts in your inbox in under a minute. Helm drafts each pitch.",
      tab: "outreach",
      mission: "press",
    };
  }
  if (s.upcomingShowsCount === 0) {
    return {
      label: "Add an upcoming show",
      detail: "Even one date makes your one-sheet look tour-active.",
      tab: "links",
    };
  }
  if (s.openOpportunities > 0) {
    return {
      label: `Review ${s.openOpportunities} new opportunit${s.openOpportunities === 1 ? "y" : "ies"}`,
      detail: "Helm surfaced these for you overnight.",
      tab: "overview",
    };
  }
  return {
    label: "Run a playlist mission",
    detail: "Independent curators in your genre. Helm finds + drafts.",
    tab: "outreach",
    mission: "playlist",
  };
}
