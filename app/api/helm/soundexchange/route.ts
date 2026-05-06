import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { decodeSession, COOKIE_NAME } from "@/lib/session";

const SE_API_URL =
  process.env.SOUNDEXCHANGE_API_URL ||
  "https://api.soundexchange.com/repertoire/v1_0/recordings/search";
const SE_API_KEY = process.env.SOUNDEXCHANGE_API_KEY || "";

export interface SoundExchangeRecording {
  isrc?: string;
  icpn?: string;
  recordingTitle?: string;
  recordingArtistName?: string;
  releaseArtistName?: string;
  releaseName?: string;
  recordingVersion?: string;
  recordingYear?: string;
  recordingType?: string;
  duration?: string;
  releaseLabel?: string;
  genre?: string[];
}

export interface SoundExchangeAuditResult {
  artistName: string;
  totalFound: number;
  recordings: SoundExchangeRecording[];
  catalogMatches: CatalogComparison[];
  missingFromCatalog: SoundExchangeRecording[];
  missingFromSoundExchange: string[];
  summary: string;
}

export interface CatalogComparison {
  trackName: string;
  foundInSoundExchange: boolean;
  isrc?: string;
  releaseName?: string;
  recordingYear?: string;
  releaseLabel?: string;
}

async function searchSoundExchange(
  artistName: string,
  start = 0,
  number = 100
): Promise<{ recordings: SoundExchangeRecording[]; totalFound: number }> {
  const body = {
    searchFields: {
      recordingArtistName: { value: artistName, whole_phrase: true },
    },
    number,
    start,
  };

  const res = await fetch(SE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": SE_API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`SoundExchange API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    recordings: data.recordings ?? [],
    totalFound: data.numberOfRecordings ?? 0,
  };
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findBestMatch(
  trackName: string,
  recordings: SoundExchangeRecording[]
): SoundExchangeRecording | null {
  const normalized = normalizeTitle(trackName);
  // Exact match first
  const exact = recordings.find(
    (r) => r.recordingTitle && normalizeTitle(r.recordingTitle) === normalized
  );
  if (exact) return exact;
  // Partial match
  const partial = recordings.find(
    (r) =>
      r.recordingTitle &&
      (normalizeTitle(r.recordingTitle).includes(normalized) ||
        normalized.includes(normalizeTitle(r.recordingTitle)))
  );
  return partial ?? null;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? decodeSession(token) : null;
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SE_API_KEY) {
    return Response.json({ error: "SoundExchange API key not configured" }, { status: 500 });
  }

  const { artistName, catalogTracks } = await req.json() as {
    artistName: string;
    catalogTracks?: string[]; // track names from their Spotify/Helm catalog
  };

  if (!artistName) {
    return Response.json({ error: "artistName is required" }, { status: 400 });
  }

  try {
    // Fetch up to 100 recordings (single page for now — covers most indie artists)
    const { recordings, totalFound } = await searchSoundExchange(artistName);

    const tracks = catalogTracks ?? [];

    // Build comparison: for each catalog track, did we find it in SoundExchange?
    const catalogMatches: CatalogComparison[] = tracks.map((trackName) => {
      const match = findBestMatch(trackName, recordings);
      return {
        trackName,
        foundInSoundExchange: !!match,
        isrc: match?.isrc,
        releaseName: match?.releaseName,
        recordingYear: match?.recordingYear,
        releaseLabel: match?.releaseLabel,
      };
    });

    // Recordings in SoundExchange not matched to any catalog track
    const matchedTitles = new Set(
      catalogMatches
        .filter((m) => m.foundInSoundExchange)
        .map((m) => m.trackName)
    );

    const missingFromCatalog = recordings.filter((r) => {
      const title = r.recordingTitle ?? "";
      return !tracks.some(
        (t) =>
          normalizeTitle(t) === normalizeTitle(title) ||
          normalizeTitle(title).includes(normalizeTitle(t)) ||
          normalizeTitle(t).includes(normalizeTitle(title))
      );
    });

    const missingFromSoundExchange = catalogMatches
      .filter((m) => !m.foundInSoundExchange)
      .map((m) => m.trackName);

    const registeredCount = catalogMatches.filter((m) => m.foundInSoundExchange).length;

    let summary = "";
    if (totalFound === 0) {
      summary = `No recordings found for "${artistName}" in the SoundExchange repertoire database. This may mean the artist name doesn't match exactly, or recordings haven't been registered with ISRCs yet.`;
    } else if (tracks.length === 0) {
      summary = `Found ${totalFound} recording${totalFound !== 1 ? "s" : ""} registered in SoundExchange for "${artistName}".`;
    } else {
      const missingPct = Math.round(((tracks.length - registeredCount) / tracks.length) * 100);
      summary = `${registeredCount} of ${tracks.length} catalog tracks found in SoundExchange. ${missingFromSoundExchange.length} track${missingFromSoundExchange.length !== 1 ? "s" : ""} may be unregistered${missingPct > 0 ? ` (${missingPct}% of catalog)` : ""}.`;
    }

    const result: SoundExchangeAuditResult = {
      artistName,
      totalFound,
      recordings,
      catalogMatches,
      missingFromCatalog,
      missingFromSoundExchange,
      summary,
    };

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
