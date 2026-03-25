import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getUserOpportunities } from "@/lib/tasks";
import { sendEmail } from "@/lib/email";
import type { OpportunityTask } from "@/lib/types";

const TYPE_EMOJI: Record<string, string> = {
  festival: "🎪",
  playlist: "🎵",
  press: "📰",
  tiktok_growth: "📱",
  sync: "💿",
};

function subjectLine(artistName: string, count: number): string {
  const first = artistName.split(" ")[0];
  const options = [
    `Helmos found ${count} new opportunit${count === 1 ? "y" : "ies"} for ${artistName}`,
    `${artistName}: ${count} door${count === 1 ? " is" : "s are"} open right now`,
    `Your growth tasks for this week, ${first}`,
  ];
  return options[Math.floor(Date.now() / 86400000) % options.length];
}

function buildHtml(firstName: string, artistName: string, artistId: string, opportunities: OpportunityTask[]): string {
  const oppRows = opportunities.map(opp => {
    const emoji = TYPE_EMOJI[opp.type] ?? "🎯";
    const deadlineRow = opp.deadline
      ? `<p style="margin:4px 0 0;font-size:12px;color:#71717a;">⏰ Deadline: ${opp.deadline}</p>`
      : "";
    const urlRow = opp.actionUrl
      ? `<p style="margin:6px 0 0;"><a href="${opp.actionUrl}" style="color:#818cf8;font-size:13px;text-decoration:none;">Apply / Learn more →</a></p>`
      : "";
    return `
      <div style="background:#111111;border:1px solid #1e1e1e;border-radius:12px;padding:16px;margin-bottom:12px;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#ffffff;">${emoji} ${opp.title}</p>
        <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5;">${opp.description}</p>
        ${deadlineRow}
        ${urlRow}
      </div>`;
  }).join("");

  const dashboardUrl = `https://helmos.co/dashboard?artist=${artistId}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#0a0a0a;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="margin-bottom:32px;">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:inline-flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-weight:bold;font-size:14px;">H</span>
      </div>
    </div>

    <p style="font-size:16px;color:#e4e4e7;margin:0 0 8px;">Hey ${firstName},</p>
    <p style="font-size:15px;color:#a1a1aa;margin:0 0 28px;">Here&apos;s what Helmos found for <strong style="color:#e4e4e7;">${artistName}</strong>:</p>

    ${oppRows}

    <div style="margin-top:32px;">
      <a href="${dashboardUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
        Log in to manage these →
      </a>
    </div>

    <hr style="border:none;border-top:1px solid #1e1e1e;margin:36px 0 24px;">
    <p style="font-size:12px;color:#52525b;margin:0 0 4px;">
      <strong style="color:#71717a;">Helmos</strong> · Your AI Chief Growth Officer
    </p>
    <p style="font-size:12px;color:#52525b;margin:0;">
      <a href="${dashboardUrl}" style="color:#52525b;text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;
}

function buildText(firstName: string, artistName: string, artistId: string, opportunities: OpportunityTask[]): string {
  const oppLines = opportunities.map(opp => {
    const emoji = TYPE_EMOJI[opp.type] ?? "🎯";
    const lines = [
      `${emoji} ${opp.title}`,
      opp.description,
      opp.actionUrl ? `Apply: ${opp.actionUrl}` : "",
      opp.deadline ? `Deadline: ${opp.deadline}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }).join("\n\n");

  return `Hey ${firstName},

Here's what Helmos found for ${artistName}:

${oppLines}

Log in to manage these: https://helmos.co/dashboard?artist=${artistId}

—
Helmos | Your AI Chief Growth Officer
`;
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  // Get new opportunities
  let opportunities = await getUserOpportunities(session.email, "new");

  // If none, trigger a quick scan inline
  if (opportunities.length === 0) {
    const body = await req.json().catch(() => ({})) as {
      artistId?: string;
      artistName?: string;
      genres?: string[];
      monthlyListeners?: number;
    };

    const scanRes = await fetch(new URL("/api/helm/opportunities/scan", req.url).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify(body),
    });

    if (scanRes.ok) {
      opportunities = await getUserOpportunities(session.email, "new");
    }
  }

  if (opportunities.length === 0) {
    return new Response(JSON.stringify({ sent: false, reason: "No opportunities to send" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const artistId = opportunities[0].artistId;
  const artistName = opportunities[0].artistName;
  const firstName = session.email.split("@")[0].split(".")[0];
  const capitalFirst = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const subject = subjectLine(artistName, opportunities.length);
  const html = buildHtml(capitalFirst, artistName, artistId, opportunities);
  const text = buildText(capitalFirst, artistName, artistId, opportunities);

  const result = await sendEmail({
    from: "Helmos <helm@helmos.co>",
    to: session.email,
    subject,
    html,
    text,
  });

  return new Response(
    JSON.stringify({ sent: !!result, emailId: result?.id ?? null, count: opportunities.length }),
    { headers: { "Content-Type": "application/json" } },
  );
}
