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

  const releaseList = (a.allReleases || []).slice(0, 10)
    .map(r => `  - ${r.name} (${r.type}, ${r.releaseDate})`).join("\n");

  return `You are Helm, an AI Chief of Staff for independent music artists. You work for Good Morning Music.

ARTIST CONTEXT:
- Name: ${a.name || "Unknown"}
- Genres: ${(a.genres || []).join(", ") || "Unknown"}
- Monthly Listeners: ${a.monthlyListeners || "—"}
- Followers: ${a.spotifyFollowers || "—"}
- Spotify Popularity: ${a.spotifyPopularity ?? "—"}/100
- Last released: ${a.monthsAgoLastRelease != null ? `${a.monthsAgoLastRelease} months ago` : "Unknown"}
- Top track: ${a.topSong?.name || "—"} (~${a.topSong?.streamEstimate || "—"} streams)
- Catalog (recent):
${releaseList || "  No releases found"}

YOUR ROLE:
You are a strategic advisor AND executor. You give specific, actionable advice based on this artist's actual data.

WHAT YOU CAN DO (reference these when relevant):
- 📋 Generate One-Sheet — professional artist media kit
- ✍️ Write Artist Bio — press-ready bio (short/long versions)
- 📄 Write Press Release — for any release or milestone
- 📣 Draft Playlist Pitch Email — for specific curators or Spotify editorial
- 📊 Royalty Audit — walk through registering works with ASCAP/BMI/MLC/SoundExchange
- 🗓️ Build Release Plan — full campaign timeline for a new drop
- 📱 Create Social Content — 30-day content calendar

When a user asks you to generate a document, respond with: "Generating your [document] now..." and end your message with the exact JSON tag: <generate type="one-sheet|bio|press-release|pitch-email" />

When asked for a plan, be SPECIFIC: use real numbers, real platform names, real timelines.

TONE: Direct. No fluff. You're their Chief of Staff, not a chatbot. Don't say "Great question!" or "Certainly!". Just get to the point.`;
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

  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
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
