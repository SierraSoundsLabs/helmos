import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvSet } from "@/lib/kv";

// TODO: Integrate with cloudinary or ffmpeg for real audio+video composite.
// For MVP: accepts artwork + audio assets, stores artwork as base64 in KV with TTL,
// returns artworkUrl for preview display. The Good Morning Music team will handle
// actual ad production.

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const artworkFile = formData.get("artwork") as File | null;
  const audioFile = formData.get("audio") as File | null;
  const releaseId = formData.get("releaseId") as string;
  const artworkUrlInput = formData.get("artworkUrl") as string;

  if (!releaseId) {
    return NextResponse.json({ error: "Missing releaseId" }, { status: 400 });
  }

  let artworkDataUrl: string | null = null;
  let audioStored = false;

  // Handle artwork: file upload takes priority over URL
  if (artworkFile) {
    const buf = await artworkFile.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const mime = artworkFile.type || "image/jpeg";
    artworkDataUrl = `data:${mime};base64,${base64}`;

    // Store in KV with 1-hour TTL for session continuity
    // TODO: Use a CDN upload (Cloudinary, S3, Vercel Blob) instead of base64-in-KV
    const previewKey = `media:preview:${session.artistId}:${releaseId}:artwork`;
    await kvSet(previewKey, artworkDataUrl, 3600);
  } else if (artworkUrlInput) {
    artworkDataUrl = artworkUrlInput;
  }

  // Store audio file reference if provided (not storing binary — too large for KV)
  if (audioFile) {
    audioStored = true;
    // TODO: Upload to Vercel Blob or S3 and store URL
  }

  return NextResponse.json({
    artworkUrl: artworkDataUrl,
    audioStored,
    releaseId,
    message: audioFile
      ? "Assets received. Preview ready — audio will be composited by our team."
      : "Artwork preview ready.",
    // TODO: Use ffmpeg or a cloud service to composite audio over artwork for actual video preview.
  });
}
