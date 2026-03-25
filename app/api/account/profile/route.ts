import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";

interface UserProfile {
  displayName: string;
}

interface NotificationPrefs {
  dailyDigest: boolean;
  weeklyGrowth: boolean;
}

interface ProfileResponse {
  displayName: string;
  notificationPrefs: NotificationPrefs;
}

const DEFAULT_PREFS: NotificationPrefs = {
  dailyDigest: true,
  weeklyGrowth: false,
};

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.email;
  const [profile, prefs] = await Promise.all([
    kvGet<UserProfile>(`helm:user:${email}:profile`),
    kvGet<NotificationPrefs>(`helm:user:${email}:notification_prefs`),
  ]);

  const response: ProfileResponse = {
    displayName: profile?.displayName ?? "",
    notificationPrefs: prefs ?? DEFAULT_PREFS,
  };

  return NextResponse.json(response);
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.email;
  const body = await req.json() as { displayName?: string; notificationPrefs?: NotificationPrefs };

  if (body.displayName !== undefined) {
    const displayName = String(body.displayName).slice(0, 100).trim();
    await kvSet(`helm:user:${email}:profile`, { displayName });
  }

  if (body.notificationPrefs !== undefined) {
    const prefs: NotificationPrefs = {
      dailyDigest: Boolean(body.notificationPrefs.dailyDigest),
      weeklyGrowth: Boolean(body.notificationPrefs.weeklyGrowth),
    };
    await kvSet(`helm:user:${email}:notification_prefs`, prefs);
  }

  return NextResponse.json({ success: true });
}
