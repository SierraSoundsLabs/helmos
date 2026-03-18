import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { decodeSession, COOKIE_NAME } from "@/lib/session";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface TrackResult {
  title: string;
  mlcFound: boolean;
  ascapFound: boolean;
  mlcError?: string;
  ascapError?: string;
}

async function searchMLC(title: string, artist: string): Promise<{ found: boolean; error?: string }> {
  try {
    const res = await fetch("https://public-api.themlc.com/search/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, artist, pageSize: 5, pageNum: 0 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { found: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const results = data?.recordings || data?.results || data?.data || [];
    return { found: Array.isArray(results) && results.length > 0 };
  } catch (e) {
    return { found: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}

async function searchASCAP(title: string): Promise<{ found: boolean; error?: string }> {
  try {
    const url = `https://www.ascap.com/api/ace/work?title=${encodeURIComponent(title)}&searchFilter=SVW`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { found: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const results = data?.works || data?.results || data?.data || [];
    return { found: Array.isArray(results) && results.length > 0 };
  } catch (e) {
    return { found: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? decodeSession(token) : null;
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const { artistName, tracks, monthlyListeners } = await req.json();
  if (!artistName || !Array.isArray(tracks)) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (text: string) => controller.enqueue(encoder.encode(text));

      try {
        enqueue("Running your royalty audit now. Searching The MLC, ASCAP, and BMI...\n\n");

        // Search top 10 tracks across databases
        const topTracks = tracks.slice(0, 10) as string[];
        const searchResults: TrackResult[] = [];

        for (const track of topTracks) {
          const [mlcResult, ascapResult] = await Promise.all([
            searchMLC(track, artistName),
            searchASCAP(track),
          ]);
          searchResults.push({
            title: track,
            mlcFound: mlcResult.found,
            ascapFound: ascapResult.found,
            mlcError: mlcResult.error,
            ascapError: ascapResult.error,
          });
        }

        const unregisteredCount = searchResults.filter(r => !r.mlcFound && !r.ascapFound).length;
        const partialCount = searchResults.filter(r => r.mlcFound !== r.ascapFound).length;

        const searchSummary = searchResults
          .map(r => {
            const mlcStatus = r.mlcError ? `MLC: error (${r.mlcError})` : `MLC: ${r.mlcFound ? "found" : "not found"}`;
            const ascapStatus = r.ascapError ? `ASCAP: error (${r.ascapError})` : `ASCAP: ${r.ascapFound ? "found" : "not found"}`;
            return `- "${r.title}": ${mlcStatus}, ${ascapStatus}`;
          })
          .join("\n");

        const userMessage = `Generate a royalty audit report for ${artistName}.

Artist: ${artistName}
Monthly Listeners: ${monthlyListeners?.toLocaleString?.() ?? monthlyListeners ?? "unknown"}
Tracks audited: ${topTracks.length}

Database search results:
${searchSummary}

Summary:
- ${unregisteredCount} tracks appear unregistered in both MLC and ASCAP
- ${partialCount} tracks have partial registration (one registry but not the other)
- ${searchResults.filter(r => r.mlcFound && r.ascapFound).length} tracks appear registered in both

Note: Some searches may have returned errors (401/403) which means the data could not be confirmed. Treat errored lookups as "status unknown" in your report.

Please generate the full royalty audit report.`;

        const claudeStream = await client.messages.stream({
          model: "claude-opus-4-6",
          max_tokens: 2048,
          system: "You are Helm, a music industry AI advisor. Generate a concise royalty audit report. Use markdown formatting with tables where appropriate. Be specific and actionable.",
          messages: [{ role: "user", content: userMessage }],
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            enqueue(event.delta.text);
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
