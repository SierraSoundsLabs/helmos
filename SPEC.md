# Helmos — Artist Dashboard MVP

## What We're Building
A Next.js web app at helmos.co. A first-time visitor enters their Spotify artist URL and gets a personalized AI-powered dashboard showing their career health + specific action items Helmos can execute for them.

## User Flow
1. Land on helmos.co → dark, clean hero with single Spotify URL input
2. Paste URL (e.g. https://open.spotify.com/artist/5K4W6rqBFWDnAN6FQUkS6x) → hit "Analyze"
3. Loading state (2-4 sec) → Dashboard appears
4. Dashboard shows their data + AI action items
5. CTA at bottom: "Let Helmos handle all of this — $49/month" → Stripe checkout

## Dashboard Layout (dark UI, similar to the landing page aesthetic)

### Left Panel — Artist Profile
- Artist photo (large)
- Name, genres (tags)
- Followers count
- Spotify popularity score (0-100)
- Monthly listeners (if available)

### Center — Career Snapshot
- Top 5 tracks (name, popularity bar, stream estimate)
- Latest release (album art, title, date, track count)
- Release cadence: "Last released X months ago"
- Top markets (if available)

### Right Panel — AI Action Items (THE PRODUCT)
3-5 specific, actionable items the Helmos agent can do RIGHT NOW. Examples:
- "Your last release was 8 months ago — Helmos can build and execute a new release plan"
- "No playlist placements detected on your top track — Helmos can pitch to 50 curators this week"
- "Your Spotify bio is incomplete — Helmos can write and update it"
- "You may be missing performance royalties — Helmos can register your catalog with ASCAP/BMI"
- "Zero social content this month — Helmos can generate and schedule 30 days of posts"

Each action item has:
- Icon + title
- 1-line description
- "Helmos can do this" badge

### Bottom CTA (full width)
Big dark card: "Your Helmos agent is ready. $49/month — cancel anytime."
Button: "Get Started" → https://buy.stripe.com/PLACEHOLDER

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (dark theme matching landing page)
- Spotify Web API (Client Credentials flow — no user login needed)
- Anthropic Claude API (for AI analysis + action item generation)
- Vercel deployment

## API Routes Needed

### GET /api/artist?spotifyUrl=...
- Extract artist ID from URL
- Call Spotify API: GET /artists/{id}, GET /artists/{id}/top-tracks, GET /artists/{id}/albums
- Return cleaned JSON: { name, image, followers, genres, popularity, topTracks, latestRelease, monthlyListeners }

### POST /api/analyze
- Body: { artistData }
- Call Claude API with artist data
- Prompt: "You are Helmos, an AI Chief of Staff for creative entrepreneurs. Analyze this Spotify artist's career data and return exactly 5 specific action items that Helmos can execute for them. Each should be concrete, urgent, and show clear value. Format as JSON array: [{ icon, title, description, urgency: 'high'|'medium' }]"
- Return: { actionItems, careerScore, headline }

## Environment Variables Needed
- SPOTIFY_CLIENT_ID
- SPOTIFY_CLIENT_SECRET  
- ANTHROPIC_API_KEY

## Design Notes
- Dark background: #080808
- Accent: #6366f1 (indigo, matches landing page)
- Cards: #0e0e0e with #1e1e1e borders
- Font: Inter or system-ui
- Loading: skeleton shimmer effect
- Mobile responsive

## File Structure
```
helmos/
  app/
    page.tsx          (landing/input page)
    dashboard/
      page.tsx        (dashboard - takes ?artist=ID param)
    api/
      artist/
        route.ts      (Spotify data fetching)
      analyze/
        route.ts      (Claude analysis)
  components/
    ArtistCard.tsx
    TrackList.tsx
    ActionItems.tsx
    CareerScore.tsx
  lib/
    spotify.ts        (Spotify API client)
    claude.ts         (Claude API client)
  tailwind.config.ts
  next.config.ts
```

## Important Notes
- Spotify Client Credentials flow: POST to https://accounts.spotify.com/api/token with grant_type=client_credentials
- No user OAuth needed — all public data
- Parse artist ID from multiple URL formats:
  - https://open.spotify.com/artist/ARTIST_ID
  - spotify:artist:ARTIST_ID
- Handle errors gracefully (invalid URL, private artist, API limits)
- The action items are THE product — make them specific, not generic
- CTA button links to https://buy.stripe.com/PLACEHOLDER (we'll swap in real Stripe link later)
