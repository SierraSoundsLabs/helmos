// Hunter.io API — email finder and verifier
// API key stored in HUNTER_API_KEY env var

const BASE = "https://api.hunter.io/v2";
const KEY = process.env.HUNTER_API_KEY;

export interface HunterEmailResult {
  email: string;
  score: number;       // 0-100 confidence
  verified: boolean;
}

// Find the most likely email for a person at a domain
export async function findEmail(
  firstName: string,
  lastName: string,
  domain: string
): Promise<HunterEmailResult | null> {
  if (!KEY) return null;
  try {
    const params = new URLSearchParams({
      domain,
      first_name: firstName,
      last_name: lastName || "",
      api_key: KEY,
    });
    const res = await fetch(`${BASE}/email-finder?${params}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const email = data?.data?.email;
    const score = data?.data?.score ?? 0;
    if (!email) return null;
    return { email, score, verified: score >= 70 };
  } catch {
    return null;
  }
}

// Verify a specific email address
export async function verifyEmail(email: string): Promise<{
  valid: boolean;
  score: number;
  status: string;
} | null> {
  if (!KEY) return null;
  try {
    const params = new URLSearchParams({ email, api_key: KEY });
    const res = await fetch(`${BASE}/email-verifier?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.data;
    if (!result) return null;
    return {
      valid: result.status === "valid",
      score: result.score ?? 0,
      status: result.status ?? "unknown",
    };
  } catch {
    return null;
  }
}

// Search all emails for a domain (useful for finding booking/management contacts)
export async function domainSearch(domain: string, limit = 5): Promise<{
  email: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  confidence: number;
}[]> {
  if (!KEY) return [];
  try {
    const params = new URLSearchParams({ domain, limit: String(limit), api_key: KEY });
    const res = await fetch(`${BASE}/domain-search?${params}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data?.emails ?? []).map((e: Record<string, unknown>) => ({
      email: e.value as string,
      firstName: e.first_name as string | undefined,
      lastName: e.last_name as string | undefined,
      position: e.position as string | undefined,
      confidence: e.confidence as number ?? 0,
    }));
  } catch {
    return [];
  }
}

// Extract domain from a website URL or email
export function extractDomain(urlOrEmail: string): string | null {
  try {
    if (urlOrEmail.includes("@")) {
      return urlOrEmail.split("@")[1].toLowerCase();
    }
    const url = urlOrEmail.startsWith("http") ? urlOrEmail : `https://${urlOrEmail}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
