# Helmos — Product Architecture
**Version 2.0 | AI Work Delivered to Your Workspace**
*Drafted March 23, 2026*

---

## Vision

Helmos is the AI-powered backstage for independent artists. It doesn't just show you data — it does real work and delivers finished assets directly into tools you already use (Google Docs, email). Every action produces something tangible: a PDF, a plan, a campaign.

**Core Promise:** *Connect your Spotify. Tell Helmos what you need. Come back to a finished doc.*

---

## Product Pillars

| Pillar | Description |
|--------|-------------|
| 🔍 **Find Money** | Royalty auditing across MLC, ASCAP, BMI, SoundExchange |
| 📋 **Do Work** | AI generates docs, plans, pitches delivered to Google Drive |
| 📊 **Stay Informed** | Monthly performance reports, alerts, Spotify stats |
| 📣 **Get Heard** | Playlist pitch campaigns, press outreach, sync licensing |

---

## User Journey

```
1. SIGN UP
   Artist lands on helmos.co
   → 3-day free trial (card required)
   → Connects Spotify (OAuth)
   → Connects Google Drive (OAuth — scoped to Helmos-created files only)
   → Stripe subscription auto-starts on day 4

2. ONBOARDING
   Helmos reads Spotify profile → pre-fills artist name, genre, top tracks
   Shows dashboard: streaming stats, royalty status, credit balance

3. RUN A TASK (credits consumed)
   Artist picks a task (e.g. "Royalty Audit")
   → Helmos runs Claude research + analysis
   → Creates a Google Doc in their Drive titled "Helmos — Royalty Audit [Month Year]"
   → Artist gets notification: "Your doc is ready" + direct link
   → 1 credit deducted

4. REPEAT / UPSELL
   Artist comes back monthly for updated reports
   Heavy users hit credit limit → upgrade to Heatseeker or buy top-up pack
```

---

## Credit System

### Plans

| Plan | Price | Credits/Month | Trial |
|------|-------|--------------|-------|
| Pro | $19/mo | 50 credits | 3 days free |
| Heatseeker | $49/mo | 200 credits | 3 days free |
| Top-Up Pack | $9 one-time | +25 credits | — |

### Credit Costs Per Task

| Task | Credits | Output |
|------|---------|--------|
| Royalty Audit | 5 | Google Doc — full audit report with MLC/ASCAP/BMI findings |
| Release Marketing Plan | 8 | Google Doc — 90-day plan with timeline, platforms, content ideas |
| Playlist Pitch Pack | 4 | Google Doc — 20 personalized curator pitches |
| Press Outreach Pack | 4 | Google Doc — 15 press emails ready to send |
| Monthly Performance Report | 2 | Google Doc — Spotify stats, trends, revenue summary |
| Sync Licensing Brief | 3 | Google Doc — artist one-pager formatted for sync pitching |
| Email Outreach Campaign | 3 | Helmos sends 10 emails on artist's behalf via SMTP |

### Credit Rules
- Credits reset monthly on billing date
- Unused credits do NOT roll over (keeps upsell pressure)
- Top-up packs expire after 6 months
- Trial accounts get 10 free credits (enough for 2 tasks)

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│   Next.js (artists.goodmornmusic.com / helmos.co)           │
│   - Dashboard, Task UI, Credit Balance, Doc History          │
└───────────────────┬─────────────────────────────────────────┘
                    │ API calls
┌───────────────────▼─────────────────────────────────────────┐
│                      API LAYER (Next.js routes)              │
│   /api/tasks/run      — Execute a task                       │
│   /api/tasks/status   — Poll task progress                   │
│   /api/credits        — Balance, history, top-up             │
│   /api/google/auth    — OAuth flow                           │
│   /api/stripe/webhook — Handle payments                      │
└──────┬──────────────┬──────────────┬───────────────┬────────┘
       │              │              │               │
┌──────▼───┐  ┌───────▼──┐  ┌───────▼────┐  ┌──────▼──────┐
│  Prisma  │  │  Claude  │  │  Google    │  │   Stripe    │
│  (DB)    │  │  API     │  │  Drive API │  │   Billing   │
│          │  │          │  │            │  │             │
│ Users    │  │ Research │  │ Create Doc │  │ Subscriptions│
│ Credits  │  │ Write    │  │ Write Doc  │  │ Webhooks    │
│ Tasks    │  │ Analyze  │  │ Share Link │  │ Credits     │
│ Docs     │  │          │  │            │  │             │
└──────────┘  └──────────┘  └────────────┘  └─────────────┘
```

### Database Schema (Prisma additions)

```prisma
model CreditBalance {
  id          String   @id @default(cuid())
  userId      String   @unique
  balance     Int      @default(0)
  totalEarned Int      @default(0)
  totalSpent  Int      @default(0)
  resetAt     DateTime
  user        User     @relation(fields: [userId], references: [id])
}

model CreditTransaction {
  id          String   @id @default(cuid())
  userId      String
  amount      Int      // positive = earned, negative = spent
  type        String   // "subscription", "topup", "task_run", "trial"
  description String
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}

model Task {
  id          String   @id @default(cuid())
  userId      String
  type        String   // "royalty_audit", "release_plan", "playlist_pitch", etc.
  status      String   // "pending", "running", "done", "failed"
  creditsUsed Int
  outputDocId String?  // Google Doc ID
  outputDocUrl String? // Direct link to the doc
  metadata    Json?    // Task-specific inputs (release date, target genres, etc.)
  createdAt   DateTime @default(now())
  completedAt DateTime?
  user        User     @relation(fields: [userId], references: [id])
}

model GoogleIntegration {
  id           String   @id @default(cuid())
  userId       String   @unique
  accessToken  String   // encrypted
  refreshToken String   // encrypted
  folderId     String?  // Helmos folder in their Drive
  connectedAt  DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id])
}
```

---

## Task Execution Engine

### How a Task Runs

```
Artist clicks "Run Royalty Audit"
        │
        ▼
1. CHECK CREDITS
   Does artist have ≥ 5 credits?
   No → Show upgrade/top-up modal
   Yes → continue
        │
        ▼
2. CREATE TASK RECORD
   Task{ status: "pending", type: "royalty_audit" }
   Deduct 5 credits optimistically
        │
        ▼
3. QUEUE EXECUTION (background job)
   Claude Agent runs:
   a. Pull artist Spotify data (name, top tracks, label, distributor)
   b. Search MLC database for unclaimed works
   c. Search ASCAP/BMI for registration gaps
   d. Search SoundExchange for digital performance royalties
   e. Compile findings into structured report
        │
        ▼
4. WRITE TO GOOGLE DOC
   - Create doc: "Helmos — Royalty Audit — [Artist] — March 2026"
   - Write formatted report with sections, tables, action items
   - Place in "Helmos" folder in artist's Drive
   - Get shareable link
        │
        ▼
5. NOTIFY ARTIST
   - Update task status: "done"
   - Show doc link on dashboard
   - Send email: "Your Royalty Audit is ready →"
        │
        ▼
6. TASK HISTORY
   Saved to dashboard — artist can re-open any past doc
```

---

## Google Drive Integration

### OAuth Scope
```
https://www.googleapis.com/auth/drive.file
```
(Helmos can only see/edit files it creates — not the artist's full Drive)

### Folder Structure Created in Artist's Drive
```
📁 Helmos/
├── 📄 Royalty Audit — March 2026
├── 📄 Release Marketing Plan — Single "Heat"
├── 📄 Playlist Pitch Pack — Hip-Hop Curators
└── 📄 Monthly Report — February 2026
```

### Doc Template Structure (example: Royalty Audit)
```
HELMOS ROYALTY AUDIT
[Artist Name] | Generated [Date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY
Your estimated unclaimed royalties: $X,XXX
Priority action: Register [song name] with MLC

FINDINGS BY REGISTRY
MLC (Mechanical Licensing Collective)
  ✅ Registered: "Song A", "Song B"
  ❌ Missing: "Song C" — estimated $XXX unclaimed
  → Action: Register at portal.themlc.com

ASCAP
  ✅ All works registered
  ⚠️ Writer shares: verify splits on "Song D"

BMI / SoundExchange / SESAC...
...

ACTION CHECKLIST
[ ] Register "Song C" with MLC
[ ] Verify splits on "Song D" with ASCAP
[ ] Apply for SoundExchange artist account

Next audit recommended: [Date +3 months]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Powered by Helmos · helmos.co
```

---

## Frontend Components Needed

| Component | Description |
|-----------|-------------|
| `CreditBalance` | Header badge showing current credits |
| `TaskLauncher` | Card grid — pick a task, see credit cost, run it |
| `TaskStatus` | Real-time progress indicator (polling /api/tasks/status) |
| `TaskHistory` | List of past tasks with doc links |
| `GoogleConnectBanner` | Prompt to connect Drive if not connected |
| `CreditModal` | Upgrade or top-up flow triggered when credits low |
| `TrialCountdown` | Banner showing days left in trial |

---

## Implementation Phases

### Phase 1 — Foundation (2 weeks)
- [ ] Google OAuth integration (drive.file scope)
- [ ] Credit balance model in DB
- [ ] Stripe webhook → credit allocation on subscription
- [ ] Basic task queue (start with 1 task: Royalty Audit)
- [ ] Google Doc creation + write from Claude output
- [ ] Task history UI

### Phase 2 — Task Library (2 weeks)
- [ ] Release Marketing Plan task
- [ ] Playlist Pitch Pack task
- [ ] Monthly Performance Report (auto-runs monthly, 0 credits)
- [ ] Credit top-up packs (one-time Stripe payment)

### Phase 3 — Polish + Growth (1 week)
- [ ] Trial countdown banner
- [ ] Low-credit alert + upgrade nudge
- [ ] Email notifications when docs are ready
- [ ] Referral credits ("Invite an artist, get 10 credits")

---

## Competitive Differentiation

| Feature | Helmos | DistroKid | TuneCore | Groover |
|---------|--------|-----------|----------|---------|
| Royalty audit | ✅ AI-powered | ❌ | ❌ | ❌ |
| Delivers to Google Docs | ✅ | ❌ | ❌ | ❌ |
| Release marketing plan | ✅ AI-generated | ❌ | ❌ | ❌ |
| Playlist pitch | ✅ AI-written | ❌ | ❌ | ✅ manual |
| Credit-based AI tasks | ✅ | ❌ | ❌ | ❌ |

**The Moat:** No one is delivering finished, usable documents into an artist's Google Drive. This is the differentiator worth marketing hard.

---

## Open Questions for Rory

1. **Task prioritization** — Which task do you want to ship first? Royalty Audit is most defensible PR story; Release Plan may have higher daily usage.
2. **Credit top-up pricing** — $9 for 25 credits feels right, or do you want larger packs (50 credits for $15)?
3. **Google OAuth timing** — Force it at signup, or let artists use Helmos without Drive and prompt later?
4. **Auto-refresh docs** — Should monthly reports auto-run and deduct credits, or require the artist to initiate?
5. **Team access** — Can an artist share their Helmos account with their manager? Future feature?

---

*Built by Paul ⚡ for Good Morning Music | helmos.co*
