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

export interface DiscoveredContact {
  email: string;
  name: string;          // "First Last" or "" if generic inbox
  position: string;      // job title or ""
  confidence: number;    // Hunter 0-100
  outlet: string;        // the outlet/venue this came from (caller-supplied)
  domain: string;
}

// Discover real contacts at an outlet/venue domain via Hunter domain-search.
// This is the discovery primitive for mission-based outreach: instead of
// asking an LLM to GUESS who works where (it hallucinates), we name the
// outlet and let Hunter return the people it has actually crawled + scored.
//
// `roleKeywords` ranks relevance (e.g. "editor","booking") — matching
// contacts sort first, but generic inboxes (booking@, pitches@) are kept
// too since those are often the right target for cold outreach.
export async function discoverContactsForDomain(
  domain: string,
  outlet: string,
  roleKeywords: string[],
  limit = 10
): Promise<DiscoveredContact[]> {
  const raw = await domainSearch(domain, limit);
  const kws = roleKeywords.map((k) => k.toLowerCase());
  const scored = raw.map((c) => {
    const hay = `${(c.position || "").toLowerCase()} ${c.email.split("@")[0].toLowerCase()}`;
    const relevant = kws.some((k) => hay.includes(k));
    return {
      contact: {
        email: c.email,
        name: [c.firstName, c.lastName].filter(Boolean).join(" "),
        position: c.position || "",
        confidence: c.confidence ?? 0,
        outlet,
        domain,
      } as DiscoveredContact,
      relevant,
    };
  });
  // Relevant roles first, then by confidence.
  return scored
    .sort((a, b) => {
      if (a.relevant !== b.relevant) return a.relevant ? -1 : 1;
      return b.contact.confidence - a.contact.confidence;
    })
    .map((s) => s.contact);
}

// Resolve an AI-suggested contact to a genuinely deliverable email address.
//
// Outreach drafts are produced by an LLM that GUESSES email addresses
// ("realistic-email@publication.com") — most of those mailboxes don't exist
// and the sends hard-bounce, which silently wastes outreach AND damages the
// helmos.co sending reputation.
//
// Strategy:
//   1. Verify the AI's guess as-is. If Hunter says it's fine, use it.
//   2. If the guess is invalid, the AI usually still got the DOMAIN right
//      (@stereogum.com) — so use Hunter's email-finder with the contact's
//      name + that domain to get the real address.
//   3. If neither works, return null so the caller drops the contact.
//
// Fails OPEN: if Hunter is unreachable / no API key, we return the original
// address rather than blocking all outreach on a Hunter outage.
export async function resolveDeliverableEmail(
  fullName: string,
  suggestedEmail: string
): Promise<{ email: string; method: "verified" | "found" | "unchecked" } | null> {
  if (!suggestedEmail || !suggestedEmail.includes("@")) return null;

  const check = await verifyEmail(suggestedEmail);

  // Hunter unavailable entirely — fail open, allow the original address.
  if (check === null) return { email: suggestedEmail, method: "unchecked" };

  // Confirmed-good — send the AI's guess as-is.
  if (check.status === "valid") {
    return { email: suggestedEmail, method: "verified" };
  }

  // Anything else — invalid, disposable, accept_all, unknown, webmail — the
  // guess is NOT confirmed. "accept_all" is the sneaky one: the domain
  // accepts every address at the SMTP handshake so Hunter can't confirm the
  // mailbox, but a wrong local-part still bounces later. So for every
  // non-valid status, try Hunter's email-finder to get the address Hunter
  // actually has on file for this person — more trustworthy than an AI guess.
  const domain = extractDomain(suggestedEmail);
  if (domain && fullName.trim()) {
    const [first, ...rest] = fullName.trim().split(/\s+/);
    const found = await findEmail(first, rest.join(" "), domain);
    if (found && found.score >= 70) {
      const recheck = await verifyEmail(found.email);
      if (!recheck || recheck.status !== "invalid") {
        return { email: found.email, method: "found" };
      }
    }
  }

  // No better address found. Drop definite bounces; for accept_all / unknown
  // (genuinely unverifiable by anyone) fall back to the guess as best-effort
  // — skipping all catch-all domains would lose too many real publications.
  if (check.status === "invalid" || check.status === "disposable") return null;
  return { email: suggestedEmail, method: "unchecked" };
}

// Lightweight send-time gate: returns true if an address should NOT be
// emailed (definite bounce risk). Fails OPEN on a Hunter outage.
export async function isUndeliverable(email: string): Promise<boolean> {
  const result = await verifyEmail(email);
  if (!result) return false; // Hunter unavailable — don't block
  return result.status === "invalid" || result.status === "disposable";
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
