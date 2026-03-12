import Anthropic from "@anthropic-ai/sdk";
import type { ArtistData } from "./spotify";

export interface AgentTask {
  title: string;
  bullets: string[];
  category: string;
  urgency: "Tonight" | "This week" | "This month";
  actionButton?: string;
}

export interface AgentDocument {
  name: string;
  description: string;
}

export interface AnalysisResult {
  agentStatus: string;
  completedItems: string[];
  tasks: AgentTask[];
  documents: AgentDocument[];
  narrative: string;
  careerStage: "Emerging" | "Growing" | "Established" | "Breakthrough";
  topOpportunity: string;
  bigWin: string | null;
  socialContent: {
    hasTikTok: boolean | null;    // null = unknown
    hasInstagram: boolean | null;
    contentOffer: string;         // what Helm offers to do
  };
  whileYouSleep: string[];       // 4-5 things Helm does autonomously at night
}

const client = new Anthropic();

const TASK_MENU_BASE = `
AVAILABLE TASK TYPES (pick the 5 most relevant for this specific artist):
1. Run royalty audit — compare recordings against ASCAP/BMI, MLC, SoundExchange
2. Pitch to Spotify editorial playlists (ONLY if upcoming release 4+ weeks out — never pitch without this)
3. Find open touring slots in their region
4. Find local shows to open for
5. Route a regional tour and email venue promoters
6. Find 10 booking agents to pitch (ONLY suggest if no agent email found in bio/website)
7. Build email list with landing page (ONLY flag as "big miss" if bio/website shows no email capture)
8. Run fan acquisition ads on Meta/Instagram
9. Find 10 music journalists in their genre for press pitches
10. Draft a press release for latest release
11. Find artists in same genre for collaboration pitches
12. Submit to college booking contacts (NACA)
13. Pitch artist managers (ONLY if no manager indicated in bio)
14. Pitch independent record labels
15. Create one-sheet with Spotify/streaming data
16. Build pre-save link for upcoming release
17. Find sync licensing opportunities
18. Create merch designs + set up merch store
19. Find podcasts in their genre for interviews
20. Optimize Spotify profile (bio, artist pick, canvas)
21. Build social content calendar (TikTok + Instagram Reels)
22. Find similar artists for playlist swaps
23. Build complete Works & Recordings catalog with splits
24. Create Google Sheet tour history
25. Create stage plot and tech rider
`;

export async function analyzeArtist(artistData: ArtistData): Promise<AnalysisResult> {
  const hasRecentRelease = (artistData.monthsAgoLastRelease ?? 99) <= 3;
  const hasUpcomingOpportunity = (artistData.monthsAgoLastRelease ?? 99) > 4;
  const listeners = (artistData as any).weeklyListeners ?? artistData.monthlyListenersRaw;
  const scrobbles = (artistData as any).totalScrobbles ?? 0;

  const prompt = `You are Helm, an AI Chief of Staff for independent musicians. You run their entire music business while they sleep and write.

Artist:
- Name: ${artistData.name}
- Genres: ${artistData.genres.join(", ") || "Independent"}
- Last.fm Weekly Listeners: ${listeners > 0 ? listeners.toLocaleString() : "unknown"}
- Last.fm Total Scrobbles: ${scrobbles > 0 ? scrobbles.toLocaleString() : "unknown"}
- Most Played Track: ${artistData.topSong?.name || "Unknown"} (${(artistData.topSong as any)?.playcount || "0"} plays)
- Top Tracks: ${artistData.topTracks.map((t) => `${t.name} (${(t as any).playcount || "?"} plays)`).join(", ") || "None"}
- Total Releases: ${artistData.allReleases.length}
- Latest Release: ${artistData.latestRelease ? `"${artistData.latestRelease.name}" (${artistData.latestRelease.type}, ${artistData.latestRelease.releaseDate})` : "None"}
- Months Since Last Release: ${artistData.monthsAgoLastRelease ?? "Unknown"}
- Artist Bio: ${artistData.bio || "Not available — no bio found"}
- Has recent release (≤3mo): ${hasRecentRelease}
- Safe to pitch editorial (release >4 weeks ago): ${hasUpcomingOpportunity}

${TASK_MENU_BASE}

SMART SUGGESTION RULES (critical — follow these exactly):
- "Email list" as a BIG MISS: Only flag if the bio gives NO indication of an email list, newsletter, or website with capture
- "Find booking agent": Only suggest if bio/known info shows NO existing agent or manager
- Editorial pitching: Only include if release ≤3 months old OR new release coming
- Focus on listener stage: <10K = foundation, 10K-100K = growth, >100K = scaling

BIG WIN: Look for the single most impressive thing in the last 12 months (high-popularity track, recent release, strong listener count, prolific output). Surface it as a highlight.

SOCIAL CONTENT: Based on their genre and listener count, assess whether they likely have active TikTok/Instagram (you cannot verify, so be honest about it). Always offer to create and schedule content since this is a core Helm service.

WHILE YOU SLEEP: Give 4-5 specific things Helm would run in the background overnight for this exact artist — be very specific to their genre, stage, and data.

Return ONLY valid JSON:
{
  "agentStatus": "Short motivational status (e.g. 'Building your touring pipeline')",
  "completedItems": [
    "Read your full catalog — [reference something specific from their bio or music — make it feel personal]",
    "Identified [specific gap with numbers from their actual data]",
    "Mapped [specific market or opportunity for their genre/region]",
    "Found [specific action-ready opportunity]"
  ],
  "tasks": [
    {
      "title": "Action-oriented title (6-8 words)",
      "bullets": [
        "Specific step referencing their actual data",
        "Specific step 2",
        "Specific step 3"
      ],
      "category": "one of: Royalties | Playlisting | Touring | Press | Strategy | Release | Sync | Outreach | Merch | Advertising | Booking | Labels | Social",
      "urgency": "Tonight | This week | This month",
      "actionButton": "Short button label or null"
    }
  ],
  "documents": [
    { "name": "Document name", "description": "Brief description" },
    { "name": "Second document", "description": "Brief description" }
  ],
  "narrative": "2-3 sentences. Reference something specific from their bio or tracks. What you found, the biggest opportunity, what subscribing unlocks. Sound like Helm already knows them.",
  "careerStage": "Emerging | Growing | Established | Breakthrough",
  "topOpportunity": "One sentence — the single biggest thing this artist is missing right now",
  "bigWin": "One sentence highlighting the most impressive thing they've done — reference specific track, release, or milestone. Or null if nothing notable found.",
  "socialContent": {
    "hasTikTok": null,
    "hasInstagram": null,
    "contentOffer": "2 sentences on what Helm would create and post for them on TikTok + Instagram — be specific to their genre and top songs"
  },
  "whileYouSleep": [
    "Specific overnight task 1 for this exact artist",
    "Specific overnight task 2",
    "Specific overnight task 3",
    "Specific overnight task 4",
    "Specific overnight task 5"
  ]
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse JSON response");

  const result = JSON.parse(jsonMatch[0]) as AnalysisResult;
  // Override bigWin with our derived one if Claude didn't find one
  if (!result.bigWin && artistData.bigWin) result.bigWin = artistData.bigWin;

  return result;
}
