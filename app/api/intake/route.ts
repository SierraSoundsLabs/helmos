import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { fetchArtistData } from "@/lib/spotify";
import { buildTaskList, createTasks, saveUserProfile, updateTask, getUserTasks, queueNextTask, type UserProfile } from "@/lib/tasks";
import { kvSet } from "@/lib/kv";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) {
    return NextResponse.json({ error: "Not subscribed" }, { status: 403 });
  }

  const body = await req.json();
  const { artistId, goals, hasRelease, releaseDate, releaseTitle, email } = body;

  if (!artistId || !goals?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Fetch artist data to populate task inputs
  let artistName = "Artist";
  let genres: string[] = ["Independent"];
  let monthlyListeners = 0;
  let latestRelease: string | undefined;

  try {
    const artist = await fetchArtistData(artistId);
    artistName = artist.name;
    genres = artist.genres?.length ? artist.genres : ["Independent"];
    monthlyListeners = artist.monthlyListeners;
    latestRelease = artist.latestRelease?.name;
  } catch {
    // Continue even if Spotify fetch fails — use defaults
  }

  const userId = session.artistId ?? artistId;

  const profile: UserProfile = {
    userId,
    artistId,
    artistName,
    goals,
    upcomingRelease: hasRelease,
    releaseDate: releaseDate || undefined,
    releaseTitle: releaseTitle || undefined,
    email: email || undefined,
    genres,
    monthlyListeners,
    latestRelease,
    createdAt: new Date().toISOString(),
  };

  await saveUserProfile(profile);

  // Store email→artistId mapping so magic link verify can find it on re-login
  const userEmail = email || session.email;
  if (userEmail) {
    await kvSet(`helm:email_artist:${userEmail.toLowerCase()}`, artistId, 60 * 60 * 24 * 365);
  }

  const taskTypes = buildTaskList(goals, hasRelease);
  const tasks = await createTasks(profile, taskTypes);

  // Send welcome email (fire and forget)
  const welcomeEmail = email || session.email;
  if (welcomeEmail) {
    sendEmail({
      to: welcomeEmail,
      from: "helm@helmos.co",
      subject: `Welcome to Helmos, ${artistName} ⚡`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
              <tr><td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:40px;">
                  <tr><td>
                    <div style="width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
                      <span style="color:#fff;font-size:22px;font-weight:700;line-height:48px;display:block;text-align:center;">H</span>
                    </div>
                    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;">Welcome to Helmos ⚡</p>
                    <p style="margin:0 0 24px;font-size:15px;color:#888;">Your agent team is now building your career plan, ${artistName}. Here's what's happening:</p>
                    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:20px;margin-bottom:24px;">
                      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:.05em;">Your agents are working on:</p>
                      ${goals.map((g: string) => `<p style="margin:0 0 6px;font-size:14px;color:#ccc;">✓ ${g.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</p>`).join("")}
                    </div>
                    <a href="https://helmos.co/dashboard?artist=${artistId}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:600;">View Your Dashboard →</a>
                    <p style="margin:28px 0 0;font-size:13px;color:#555;">We'll email you as each agent completes their work. Results typically arrive within 24 hours.</p>
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </body>
        </html>
      `,
      text: `Welcome to Helmos, ${artistName}!\n\nYour agent team is now working on your career plan.\n\nView your dashboard: https://helmos.co/dashboard?artist=${artistId}\n\nWe'll email you as each agent completes their work.`,
    }).catch(() => {}); // fire and forget
  }

  // Fire first agent task immediately (don't wait for cron)
  // Run in background — don't block the response
  const baseUrl = req.nextUrl.origin;
  fetch(`${baseUrl}/api/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch(() => {}); // fire and forget

  return NextResponse.json({ ok: true, taskCount: tasks.length });
}
