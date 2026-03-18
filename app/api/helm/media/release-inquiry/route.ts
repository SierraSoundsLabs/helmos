import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MEDIA_EMAIL = "rp@goodmornmusic.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "helm@helmos.co";

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";

  // Handle JSON body (general promotion)
  if (contentType.includes("application/json")) {
    const body = await req.json();
    const { artistName, campaignType, goals, dailyBudget, duration, total } = body;

    const emailBody = {
      from: FROM_EMAIL,
      to: [MEDIA_EMAIL],
      subject: `General Campaign Request — ${artistName}`,
      html: `
        <h2>General Promotion Campaign Request</h2>
        <p><strong>Artist:</strong> ${artistName}</p>
        <p><strong>Campaign Type:</strong> ${campaignType}</p>
        <p><strong>Goals:</strong> ${goals}</p>
        <p><strong>Daily Budget:</strong> $${dailyBudget}/day</p>
        <p><strong>Duration:</strong> ${duration} days</p>
        <p><strong>Total Budget:</strong> $${total}</p>
      `,
    };

    if (!RESEND_API_KEY) {
      console.log("No RESEND_API_KEY — would send email:", { to: MEDIA_EMAIL, subject: emailBody.subject });
      return NextResponse.json({ success: true });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailBody),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Handle FormData (release creative upload)
  const formData = await req.formData();
  const creativeFile = formData.get("creative") as File | null;
  const releaseId = formData.get("releaseId") as string;
  const releaseName = formData.get("releaseName") as string;
  const notes = formData.get("notes") as string;
  const artistName = formData.get("artistName") as string;

  if (!creativeFile || !releaseId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const creativeBuffer = await creativeFile.arrayBuffer();
  const creativeBase64 = Buffer.from(creativeBuffer).toString("base64");
  const creativeExt = creativeFile.name.split(".").pop() || "jpg";

  const emailBody = {
    from: FROM_EMAIL,
    to: [MEDIA_EMAIL],
    subject: `Release Campaign Request — ${artistName}: ${releaseName}`,
    html: `
      <h2>Release Campaign Request</h2>
      <p><strong>Artist:</strong> ${artistName}</p>
      <p><strong>Release:</strong> ${releaseName} (ID: ${releaseId})</p>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
      <p><em>Ad creative attached.</em></p>
    `,
    attachments: [
      {
        filename: `creative-${artistName.replace(/\s+/g, "-").toLowerCase()}.${creativeExt}`,
        content: creativeBase64,
      },
    ],
  };

  if (!RESEND_API_KEY) {
    console.log("No RESEND_API_KEY — would send email:", { to: MEDIA_EMAIL, subject: emailBody.subject });
    return NextResponse.json({ success: true });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailBody),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
