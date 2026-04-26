// Bandsintown public API — no key required, just an app_id
const APP_ID = "helm_goodmornmusic";
const BASE = "https://rest.bandsintown.com";

export interface BITVenue {
  name: string;
  city: string;
  region: string;
  country: string;
  latitude: string;
  longitude: string;
}

export interface BITEvent {
  id: string;
  datetime: string;
  title: string;
  description: string;
  url: string;
  venue: BITVenue;
  lineup: string[];
}

export interface BITArtist {
  id: string;
  name: string;
  url: string;
  image_url: string;
  tracker_count: number;
  upcoming_event_count: number;
}

export async function getBITArtist(artistName: string): Promise<BITArtist | null> {
  try {
    const res = await fetch(
      `${BASE}/artists/${encodeURIComponent(artistName)}?app_id=${APP_ID}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error || data?.Message) return null;
    return data as BITArtist;
  } catch {
    return null;
  }
}

export async function getBITPastEvents(artistName: string, limit = 20): Promise<BITEvent[]> {
  try {
    const res = await fetch(
      `${BASE}/artists/${encodeURIComponent(artistName)}/events?app_id=${APP_ID}&date=past`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return (data as BITEvent[]).slice(0, limit);
  } catch {
    return [];
  }
}

export async function getBITUpcomingEvents(artistName: string): Promise<BITEvent[]> {
  try {
    const res = await fetch(
      `${BASE}/artists/${encodeURIComponent(artistName)}/events?app_id=${APP_ID}`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data as BITEvent[];
  } catch {
    return [];
  }
}

// Formats past shows into a human-readable credential string
export function formatShowHistory(events: BITEvent[]): string {
  if (!events.length) return "";
  const sorted = [...events].sort((a, b) =>
    new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
  );
  return sorted.slice(0, 10).map(e => {
    const date = new Date(e.datetime).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const venue = e.venue?.name || "Unknown Venue";
    const city = [e.venue?.city, e.venue?.region].filter(Boolean).join(", ");
    const bill = e.description || e.title || "";
    return `${date}: ${venue}, ${city}${bill ? ` (${bill})` : ""}`;
  }).join("\n");
}
