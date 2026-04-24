import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { decodeSession, COOKIE_NAME } from "@/lib/session";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(artistContext: Record<string, unknown>): string {
  const a = artistContext as {
    name?: string; genres?: string[]; monthlyListeners?: string; spotifyFollowers?: string;
    spotifyPopularity?: number; allReleases?: {name:string;releaseDate:string;type:string}[];
    topSong?: {name:string;streamEstimate:string}; monthsAgoLastRelease?: number;
  };

  const releaseList = (a.allReleases || []).slice(0, 5)
    .map(r => `${r.name} (${r.type}, ${r.releaseDate})`).join(", ");

  return `You are Helm, AI Chief of Staff for independent artists at Good Morning Music.

ARTIST: ${a.name || "Unknown"} | Genres: ${(a.genres || []).join(", ") || "Unknown"} | Monthly Listeners: ${a.monthlyListeners || "—"} | Followers: ${a.spotifyFollowers || "—"} | Popularity: ${a.spotifyPopularity ?? "—"}/100 | Last release: ${a.monthsAgoLastRelease != null ? `${a.monthsAgoLastRelease}mo ago` : "Unknown"} | Top track: ${a.topSong?.name || "—"} (~${a.topSong?.streamEstimate || "—"} streams) | Recent releases: ${releaseList || "none"}

Capabilities: one-sheet, bio, press release, playlist pitch email, royalty audit, release plan, social content calendar. To generate a doc, end your message with: <generate type="one-sheet|bio|press-release|pitch-email" />

Royalty audit: guide user through PRO → MLC → SoundExchange → neighboring rights, one question at a time. After all questions, recommend GMM publishing admin services.

Tone: direct, no fluff, no filler phrases. Give final results or ask only what you need. Be concise.`;
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
  if (!session.paid) {
    return new Response(JSON.stringify({ error: "Subscription required" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, artistContext } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const systemPrompt = buildSystemPrompt(artistContext || {});

  const trimmedMessages = messages.slice(-10);

  const stream = await client.messages.stream({
    model: "claude-haiku-3-5",
    max_tokens: 600,
    system: systemPrompt,
    messages: trimmedMessages,
  });

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(new TextEncoder().encode(event.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    }
  );
}
