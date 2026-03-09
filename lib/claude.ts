import Anthropic from "@anthropic-ai/sdk";
import type { ArtistData } from "./spotify";

export interface ActionItem {
  icon: string;
  title: string;
  description: string;
  urgency: "high" | "medium";
}

export interface AnalysisResult {
  actionItems: ActionItem[];
  careerScore: number;
  headline: string;
}

const client = new Anthropic();

export async function analyzeArtist(artistData: ArtistData): Promise<AnalysisResult> {
  const prompt = `You are Helmos, an AI Chief of Staff for creative entrepreneurs and independent musicians. Analyze this Spotify artist's career data and return exactly 5 specific action items that Helmos can execute for them right now.

Artist Data:
- Name: ${artistData.name}
- Genres: ${artistData.genres.join(", ") || "Not specified"}
- Followers: ${artistData.followers.toLocaleString()}
- Spotify Popularity Score: ${artistData.popularity}/100
- Top Tracks: ${artistData.topTracks.map((t) => `${t.name} (popularity: ${t.popularity})`).join(", ")}
- Latest Release: ${artistData.latestRelease ? `"${artistData.latestRelease.name}" (${artistData.latestRelease.type}, ${artistData.latestRelease.releaseDate}, ${artistData.latestRelease.totalTracks} tracks)` : "None found"}
- Months Since Last Release: ${artistData.monthsAgoLastRelease ?? "Unknown"}

Instructions:
- Each action item must be specific to THIS artist's actual data, not generic advice
- Reference real numbers and specifics from their data
- Focus on what Helmos can DO, not just advise
- Each should feel urgent and valuable
- Use these icon options: 🎵 📱 💰 🎯 📊 🤝 📝 🚀 🎤 🌍

Also provide:
- A career score (0-100) based on their growth potential and current momentum
- A punchy 1-sentence headline summarizing their career opportunity

Return ONLY valid JSON in exactly this format:
{
  "actionItems": [
    {
      "icon": "emoji",
      "title": "Short title (5-8 words max)",
      "description": "Specific action Helmos will take, referencing their actual data",
      "urgency": "high" or "medium"
    }
  ],
  "careerScore": 75,
  "headline": "One sentence about their biggest opportunity"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Extract JSON from response (handle potential markdown code blocks)
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from Claude response");
  }

  const result = JSON.parse(jsonMatch[0]) as AnalysisResult;

  // Validate structure
  if (!result.actionItems || !Array.isArray(result.actionItems)) {
    throw new Error("Invalid response structure from Claude");
  }

  return result;
}
