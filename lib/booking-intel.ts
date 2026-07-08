// Booking Intel — AI-driven venue discovery + Hunter talent-buyer enrichment.
//
// History: this module originally pulled venue lists from Bandsintown's past-
// events feed (real tour history from similar artists). Bandsintown then
// restricted their public API and the pull started returning nothing, so
// the "Booking Intel" tab was silently broken in production for weeks.
//
// This rewrite replaces the dead Bandsintown path with a Claude call that
// names real, currently-operating venues in the target city, sized to the
// artist's draw. Hunter enrichment for talent-buyer contacts is unchanged.
// The map + UX shell in components/BookingIntelTab.tsx still work.
//
// What we lose vs. the old prototype:
//   - "This exact similar artist played here on this exact date" provenance.
//     Bandsintown gave us that; Claude cannot. Instead we return a `whyMatch`
//     sentence — Claude's reasoning for why the venue fits.
// What we keep:
//   - Real, verifiable venue names (Claude is very good at this — same call
//     shape the outreach-mission venue path uses in production today)
//   - Rough lat/lng for the map
//   - Hunter contact discovery (unchanged)

import Anthropic from "@anthropic-ai/sdk";
import { discoverContactsForDomain, DiscoveredContact } from "./hunter";
import type { ArtistData } from "./spotify";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface VenueHit {
  venueName: string;
  city: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  whyMatch: string;
  matchScore: number; // 0-100, computed from capacity ↔ draw fit
  knownDomain?: string; // If Claude knows the venue's real domain, we use it
}

export interface EnrichedVenue extends VenueHit {
  contacts: DiscoveredContact[];
  contactsLoading?: boolean;
  contactsError?: string;
}

interface VenueFromModel {
  venueName?: string;
  neighborhood?: string;
  capacity?: number;
  latitude?: number;
  longitude?: number;
  whyMatch?: string;
  domain?: string;
}

/**
 * Ask Claude to name real, operating venues in `city` that fit `artist`.
 * The prompt is deliberately narrow: real venues only, refuse to invent.
 * We use the same "no hallucinated outlets" convention that the outreach
 * mission generator has been running in production without incident.
 */
export async function findVenuesByCity(
  artist: ArtistData,
  city: string,
  count = 12
): Promise<VenueHit[]> {
  if (!city?.trim()) return [];

  const listeners = artist.monthlyListeners || 0;
  const genres = (artist.genres || []).slice(0, 3).join(", ") || "indie";
  const drawTier = listenerTierLabel(listeners);

  const prompt = `List ${count} real, currently-operating music venues in ${city} that would be a good fit for the artist ${artist.name} (${genres}, ${artist.monthlyListenersFormatted || listeners.toLocaleString()} monthly Spotify listeners — ${drawTier}).

Rules — read carefully:
1. Only venues you are confident actually exist and currently book live music. If you're not sure, skip it. Better 6 real venues than 12 with guesses.
2. Match the room size to the artist's draw tier (${drawTier}).
3. For each venue provide approximate latitude/longitude coordinates (for a map pin). Rough is fine — city-block precision is not required.
4. If you know the venue's real primary website domain (e.g. "mercuryeastpresents.com"), include it. Otherwise omit — do not guess.
5. "whyMatch" is one short sentence explaining why THIS venue fits THIS artist. Reference the genre, capacity, or booking pattern — not made-up tour history.

Return ONLY a JSON array (no prose), each item shaped:
{
  "venueName": "Exact real venue name",
  "neighborhood": "e.g. Lower East Side",
  "capacity": 250,
  "latitude": 40.7215,
  "longitude": -73.9895,
  "whyMatch": "One sentence.",
  "domain": "venuewebsite.com or omit"
}`;

  let raw = "";
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
  } catch (err) {
    console.error("[Booking Intel] venue discovery LLM call failed:", err);
    return [];
  }

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  let parsed: VenueFromModel[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((v): v is VenueFromModel & { venueName: string; whyMatch: string } =>
      typeof v?.venueName === "string" &&
      v.venueName.trim().length > 0 &&
      typeof v?.whyMatch === "string"
    )
    .map((v) => ({
      venueName: v.venueName.trim(),
      city,
      neighborhood: v.neighborhood?.trim() || undefined,
      capacity: typeof v.capacity === "number" ? v.capacity : undefined,
      latitude: typeof v.latitude === "number" ? v.latitude : undefined,
      longitude: typeof v.longitude === "number" ? v.longitude : undefined,
      whyMatch: v.whyMatch.trim(),
      matchScore: scoreCapacityFit(v.capacity, listeners),
      knownDomain: v.domain?.trim() || undefined,
    }));
}

function listenerTierLabel(listeners: number): string {
  if (listeners < 5_000) return "DIY / very small rooms, 50–150 cap";
  if (listeners < 25_000) return "small independent venues, 150–350 cap";
  if (listeners < 100_000) return "mid-size independent clubs, 300–700 cap";
  if (listeners < 500_000) return "established indie venues, 700–1,500 cap";
  return "theaters and large indie rooms, 1,500+ cap";
}

function scoreCapacityFit(capacity: number | undefined, listeners: number): number {
  if (!capacity || capacity <= 0) return 70; // no data → neutral
  // Rough model: an artist's ideal room is ~2% of their monthly-listener count,
  // clamped. If the room is within 2× either direction we call it a strong fit.
  const ideal = Math.max(80, Math.min(3000, listeners * 0.02));
  const ratio = capacity / ideal;
  const distance = Math.abs(Math.log2(ratio)); // 0 = perfect, 1 = 2× off, 2 = 4× off
  const score = Math.round(95 - distance * 20);
  return Math.max(45, Math.min(97, score));
}

/**
 * Enrich a list of venues with real talent-buyer contacts via Hunter.
 * Uses the venue's Claude-provided domain when known, otherwise falls back
 * to a rough domain guess. Preserves the "prototype-quality but useful"
 * behavior the original module had here.
 */
export async function enrichVenuesWithContacts(
  venues: VenueHit[],
  onProgress?: (index: number, total: number) => void
): Promise<EnrichedVenue[]> {
  const enriched: EnrichedVenue[] = [];

  for (let i = 0; i < venues.length; i++) {
    const v = venues[i];
    onProgress?.(i, venues.length);

    const domain = v.knownDomain || guessVenueDomain(v.venueName);
    let contacts: DiscoveredContact[] = [];
    let error: string | undefined;

    if (domain) {
      try {
        contacts = await discoverContactsForDomain(
          domain,
          v.venueName,
          ["booking", "talent buyer", "talent", "promoter", "events", "programming", "calendar", "booker"],
          8
        );
      } catch {
        error = "Contact lookup failed";
      }
    } else {
      error = "No domain available for this venue";
    }

    enriched.push({
      ...v,
      contacts,
      contactsError: error,
    });
  }

  onProgress?.(venues.length, venues.length);
  return enriched;
}

function guessVenueDomain(venueName: string): string | null {
  const cleaned = venueName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "");
  if (cleaned.length < 4) return null;
  return `${cleaned}.com`;
}
