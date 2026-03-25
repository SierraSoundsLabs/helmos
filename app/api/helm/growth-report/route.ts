import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { fetchArtistData } from "@/lib/spotify";
import { kvGet, kvSet } from "@/lib/kv";
import { sendEmail } from "@/lib/email";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface MonthlyStats {
  monthlyListeners: number;
  followers: number;
  topTrack: string;
  recordedAt: string;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonthKey(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return "N/A";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { artistId?: string };
  if (!body.artistId) {
    return NextResponse.json({ error: "Missing artistId" }, { status: 400 });
  }

  const { artistId } = body;
  const artist = await fetchArtistData(artistId);

  const currentMonth = currentMonthKey();
  const lastMonth = lastMonthKey();

  // Fetch last month's stats from KV
  const lastMonthStats = await kvGet<MonthlyStats>(
    `helm:artist:${artistId}:stats:${lastMonth}`
  );

  // Store current stats
  const currentStats: MonthlyStats = {
    monthlyListeners: artist.monthlyListeners,
    followers: artist.spotifyFollowers,
    topTrack: artist.topSong?.name ?? artist.topTracks[0]?.name ?? "N/A",
    recordedAt: new Date().toISOString(),
  };
  await kvSet(
    `helm:artist:${artistId}:stats:${currentMonth}`,
    currentStats
  );

  // Build growth narrative context
  const listenerChange = lastMonthStats
    ? pctChange(currentStats.monthlyListeners, lastMonthStats.monthlyListeners)
    : null;
  const followerChange = lastMonthStats
    ? pctChange(currentStats.followers, lastMonthStats.followers)
    : null;

  const hasHistory = lastMonthStats !== null;

  const prompt = `Write a monthly growth report for this music artist.

Artist: ${artist.name}
Current Monthly Listeners: ${artist.monthlyListenersFormatted}
${hasHistory ? `Last Month Monthly Listeners: ${lastMonthStats!.monthlyListeners.toLocaleString()}` : "Last Month: No data (first report)"}
${listenerChange ? `Listener Change: ${listenerChange}` : ""}

Current Spotify Followers: ${artist.spotifyFollowersFormatted}
${hasHistory ? `Last Month Followers: ${lastMonthStats!.followers.toLocaleString()}` : ""}
${followerChange ? `Follower Change: ${followerChange}` : ""}

Top Track This Month: ${currentStats.topTrack}
${lastMonthStats?.topTrack && lastMonthStats.topTrack !== currentStats.topTrack ? `Top Track Last Month: ${lastMonthStats.topTrack}` : ""}

Genre: ${artist.genres.slice(0, 2).join(", ") || "independent"}
${artist.bigWin ? `Recent Win: ${artist.bigWin}` : ""}

Write a warm, plain-English growth report. Be direct and specific with numbers.

Structure:
1. Opening: 2-sentence summary of where they're at this month. Use the actual numbers.
2. Growth Analysis: What changed, what it means. If no history, note this is the baseline.
3. Top Track: Highlight the best-performing track and what that signals.
4. 3 Action Recommendations: Specific, actionable next steps for the next 30 days. Number them.

Tone: Like a trusted advisor who's excited about their progress but also direct about what to do next. Not corporate. Use "you" and "your music."

Return only the report text, no headers or labels.`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const report = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

  // Send email via Resend
  const emailResult = await sendEmail({
    to: session.email,
    from: "hello@helmos.co",
    subject: `${artist.name} — Your ${new Date().toLocaleString("en-US", { month: "long", year: "numeric" })} Growth Report`,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <h2 style="color: #1a1a1a; border-bottom: 2px solid #f0f0f0; padding-bottom: 12px;">
    📊 ${artist.name} — Monthly Growth Report
  </h2>
  <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px; font-weight: bold;">Monthly Listeners</td>
        <td style="padding: 8px;">${artist.monthlyListenersFormatted}${listenerChange ? ` <span style="color: ${listenerChange.startsWith("+") ? "#16a34a" : "#dc2626"}">(${listenerChange})</span>` : ""}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Followers</td>
        <td style="padding: 8px;">${artist.spotifyFollowersFormatted}${followerChange ? ` <span style="color: ${followerChange.startsWith("+") ? "#16a34a" : "#dc2626"}">(${followerChange})</span>` : ""}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Top Track</td>
        <td style="padding: 8px;">${currentStats.topTrack}</td>
      </tr>
    </table>
  </div>
  <div style="white-space: pre-wrap; line-height: 1.6;">${report}</div>
  <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e5e5;" />
  <p style="color: #666; font-size: 12px;">Sent by Helmos — your AI music chief of staff.</p>
</div>`,
    text: `${artist.name} — Monthly Growth Report\n\nMonthly Listeners: ${artist.monthlyListenersFormatted}${listenerChange ? ` (${listenerChange})` : ""}\nFollowers: ${artist.spotifyFollowersFormatted}${followerChange ? ` (${followerChange})` : ""}\nTop Track: ${currentStats.topTrack}\n\n${report}`,
  });

  const stats = {
    currentMonth,
    monthlyListeners: currentStats.monthlyListeners,
    monthlyListenersFormatted: artist.monthlyListenersFormatted,
    followers: currentStats.followers,
    followersFormatted: artist.spotifyFollowersFormatted,
    listenerChange,
    followerChange,
    topTrack: currentStats.topTrack,
    hasHistoricalData: hasHistory,
  };

  return NextResponse.json({
    report,
    stats,
    emailSent: emailResult !== null,
  });
}
