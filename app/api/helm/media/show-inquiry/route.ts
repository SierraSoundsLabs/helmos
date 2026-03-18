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

  const formData = await req.formData();
  const flyerFile = formData.get("flyer") as File | null;
  const showName = formData.get("showName") as string;
  const date = formData.get("date") as string;
  const venue = formData.get("venue") as string;
  const notes = formData.get("notes") as string;
  const artistName = formData.get("artistName") as string;

  if (!flyerFile || !showName || !date || !venue) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Convert flyer to base64 for email attachment
  const flyerBuffer = await flyerFile.arrayBuffer();
  const flyerBase64 = Buffer.from(flyerBuffer).toString("base64");
  const flyerExt = flyerFile.name.split(".").pop() || "jpg";

  const emailBody = {
    from: FROM_EMAIL,
    to: [MEDIA_EMAIL],
    subject: `Show Campaign Request — ${artistName}: ${showName}`,
    html: `
      <h2>Show Campaign Request</h2>
      <p><strong>Artist:</strong> ${artistName}</p>
      <p><strong>Show Name:</strong> ${showName}</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Venue:</strong> ${venue}</p>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
      <p><em>Flyer attached.</em></p>
    `,
    attachments: [
      {
        filename: `flyer-${artistName.replace(/\s+/g, "-").toLowerCase()}.${flyerExt}`,
        content: flyerBase64,
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
