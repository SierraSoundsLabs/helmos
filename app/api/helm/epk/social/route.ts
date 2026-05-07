import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";

interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  appleMusic?: string;
  website?: string;
}

interface ProfileData {
  socialLinks?: SocialLinks;
  displayName?: string;
}

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileKey = `helm:user:${session.email}:profile`;
  const profile = await kvGet<ProfileData>(profileKey);
  return NextResponse.json({ socialLinks: profile?.socialLinks ?? {} });
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { artistId?: string; socialLinks: SocialLinks };
  if (!body.socialLinks) return NextResponse.json({ error: "socialLinks required" }, { status: 400 });

  // Sanitize — only keep non-empty strings
  const cleaned: SocialLinks = {};
  for (const [k, v] of Object.entries(body.socialLinks)) {
    if (typeof v === "string" && v.trim()) {
      (cleaned as Record<string, string>)[k] = v.trim();
    }
  }

  const profileKey = `helm:user:${session.email}:profile`;
  const existing = await kvGet<ProfileData>(profileKey) ?? {};
  await kvSet(profileKey, { ...existing, socialLinks: cleaned });

  return NextResponse.json({ ok: true, socialLinks: cleaned });
}
