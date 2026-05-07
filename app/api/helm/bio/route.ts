import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { kvGet, kvSet } from "@/lib/kv";

export interface SavedBio {
  artistId: string;
  artistName: string;
  short: string;   // ~50 words
  medium: string;  // ~150 words
  long: string;    // ~300 words
  raw: string;     // full generated markdown
  savedAt: string;
  generatedFrom?: "interview" | "spotify-only";
}

/** Strip markdown formatting for plain-text display and copy */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")          // ## headings
    .replace(/^(?:Short|Medium|Long)\s+Bio[^\n]*/gim, "") // "Short Bio (50 words)" labels
    .replace(/\*\*([^*]+)\*\*/g, "$1")   // **bold**
    .replace(/\*([^*]+)\*/g, "$1")        // *italic*
    .replace(/^[-–—]\s*/gm, "")           // leading dashes
    .replace(/^>\s*/gm, "")              // blockquotes
    .replace(/\n{3,}/g, "\n\n")           // excess blank lines
    .trim();
}

/** Extract a bio section by label, return plain text */
function extractSection(content: string, ...labels: string[]): string {
  for (const label of labels) {
    // Match ## Short Bio (50 words), **Short Bio (50 words)**, Short Bio (50 words):, etc.
    const pattern = new RegExp(
      `(?:#{1,3}\\s*|\\*\\*)?${label}[^\\n]*(?:\\*\\*)?[:\\s]*\\n+([\\s\\S]+?)(?=\\n{2,}(?:#{1,3}\\s+|\\*\\*[A-Z])|$)`,
      "i"
    );
    const m = content.match(pattern);
    if (m?.[1]) return stripMarkdown(m[1]);
  }
  return "";
}

// GET: fetch saved bio for an artist
export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artistId = req.nextUrl.searchParams.get("artistId");
  if (!artistId) return NextResponse.json({ error: "artistId required" }, { status: 400 });

  const bio = await kvGet<SavedBio>(`helm:artist:${artistId}:bio`);
  return NextResponse.json({ bio: bio ?? null });
}

// POST: save or update a generated bio
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session?.paid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    artistId: string;
    artistName: string;
    content?: string;       // raw generated text (from generate flow)
    short?: string;         // direct override (from edit flow)
    medium?: string;
    long?: string;
    generatedFrom?: "interview" | "spotify-only";
  };

  const { artistId, artistName, content, generatedFrom } = body;
  if (!artistId) return NextResponse.json({ error: "Missing artistId" }, { status: 400 });

  let short: string;
  let medium: string;
  let long: string;

  if (body.short !== undefined || body.medium !== undefined || body.long !== undefined) {
    // Direct edit — use provided values, fall back to existing
    const existing = await kvGet<SavedBio>(`helm:artist:${artistId}:bio`);
    short  = body.short  ?? existing?.short  ?? "";
    medium = body.medium ?? existing?.medium ?? "";
    long   = body.long   ?? existing?.long   ?? "";
  } else if (content) {
    // Parse from generated markdown
    short  = extractSection(content, "Short Bio", "Short")  || stripMarkdown(content.slice(0, 400));
    medium = extractSection(content, "Medium Bio", "Medium") || stripMarkdown(content.slice(0, 900));
    long   = extractSection(content, "Long Bio", "Long")    || stripMarkdown(content);
  } else {
    return NextResponse.json({ error: "No content or fields provided" }, { status: 400 });
  }

  const bio: SavedBio = {
    artistId,
    artistName,
    short,
    medium,
    long,
    raw: content ?? "",
    savedAt: new Date().toISOString(),
    generatedFrom: generatedFrom ?? "spotify-only",
  };

  await kvSet(`helm:artist:${artistId}:bio`, bio, 60 * 60 * 24 * 365);
  return NextResponse.json({ ok: true, bio });
}
