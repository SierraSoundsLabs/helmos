// Minimal SoundExchange helper.
//
// The existing app/api/helm/soundexchange/route.ts owns the full audit
// pipeline (catalog compare, missing-from-registry detection, etc). This
// module is for the LIGHTWEIGHT case: I just want to know how many
// recordings SoundExchange has under an artist's name, so I can surface
// it in the Daily Brief without dragging in the audit machinery.
//
// A live search takes ~600ms. That's fine on demand but too much to hit
// on every dashboard load, so callers should cache the result (7-day TTL
// is plenty — SoundExchange registrations don't move fast).

const SE_API_URL =
  process.env.SOUNDEXCHANGE_API_URL ||
  "https://api.soundexchange.com/repertoire/v1_0/recordings/search";
const SE_API_KEY = process.env.SOUNDEXCHANGE_API_KEY || "";

export interface SoundExchangeCount {
  count: number;       // total recordings registered under this artist name
  checkedAt: string;   // ISO timestamp
}

/**
 * Returns just the count of SoundExchange registrations for an artist.
 * Returns null on error/timeout — callers should handle that gracefully
 * (e.g. skip the surface, don't cache the failure).
 *
 * NOTE: SoundExchange rejects `number` values below 10 with a 422
 * ("Invalid page size, number must be between 10 and 100"). We ask for
 * the minimum page size (10) even though we only use the total count
 * field — the wasted rows are irrelevant.
 */
export async function getSoundExchangeCount(
  artistName: string,
  timeoutMs = 4000
): Promise<number | null> {
  if (!artistName?.trim() || !SE_API_KEY) return null;

  const body = {
    searchFields: {
      recordingArtistName: { value: artistName.trim(), whole_phrase: true },
    },
    number: 10,
    start: 0,
  };

  try {
    const res = await fetch(SE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SE_API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const total = data?.numberOfRecordings;
    return typeof total === "number" ? total : 0;
  } catch {
    return null;
  }
}
