# Helm Engineering Log

Append-only journal — most recent at the top. Read at the start of each Claude Code session.

---

## 2026-05-14 — Chat UI fixes + real OneSheet updates

Rory reported (with screen recording):
1. Chat input jumping off-screen while typing.
2. Layout too sidebar-heavy.
3. "Update my one-sheet" via chat — bot confirms, nothing changes.

**1. Chat UI (`fix(chat-ui)`).**
   - Removed the dual-state height (640px → 780px) and the matching grid
     width change. Both transitions firing together while typing was
     pushing the input below the viewport fold.
   - Chat is now `h-[min(720px,calc(100dvh-7rem))]` — viewport-bound,
     constant regardless of waiting state.
   - Chat panel is `lg:sticky top-4` so it stays visible as the dashboard
     scrolls.
   - Grid changed `1fr_560px` → `minmax(0,2fr) minmax(420px,3fr)` for a
     ~40/60 split that respects min/max constraints.

**2. Bio update path (`fix(chat)`).**
   Root cause of the "update doesn't stick" complaint:
   - No `<save-bio>` tag — Claude could not actually save a bio edit.
   - `<generate type="bio" />` triggers the 5-question interview, not an
     in-place edit. Wrong action for "add my new collab."
   - The one-sheet publish route reads bio from the REQUEST BODY, not
     from KV, so even an out-of-band bio update wouldn't reach the
     regenerated one-sheet without the dashboard re-fetching first.

   Fix:
   - `buildSystemPrompt` accepts `currentBio` and embeds the saved
     short/medium/long verbatim so Claude can do intelligent in-place
     updates (preserve unchanged copy, edit only what was asked).
   - New UPDATING THE BIO IN PLACE rule in the prompt: don't
     re-interview, edit, fire `<save-bio>` + `<generate
     type="one-sheet" />` in the same response.
   - New ONE-SHEET DATA SOURCES section: tells Claude what's editable
     via chat (bio, shows) vs. elsewhere (social links → Links tab,
     press quotes → EPK) vs. immutable from Spotify (tracks, releases,
     listener counts). Stops the "I'll add that song" lying pattern.
   - Dashboard caches `savedBioContent` and passes it as `currentBio`
     in the chat payload.
   - Chat handler detects `<save-bio>`, POSTs to `/api/helm/bio`
     (already supported partial updates), refreshes local state, then
     the existing `<generate type="one-sheet" />` path picks up the
     new bio from KV via `handleGenerateDoc("one-sheet")`.

   End-to-end verified flow:
   ```
   user: "update my bio to mention my collab with X"
   claude: reads current bio from system prompt
         → <save-bio short="…with X…" medium="…" long="…" />
         → <generate type="one-sheet" />
   handler: POSTs to /api/helm/bio (saves to KV)
   handler: handleGenerateDoc fetches saved bio, calls publish
   publish: writes new onesheet:{slug}
   result: helmos.co/{slug} reflects the edit immediately
   ```

   Tracks/releases/listeners remain Spotify-derived and unchangeable —
   the prompt makes Claude honest about this.

---

## 2026-05-14 — Followup batch 2: cleanup + Helm-hosted inbox

Rory's decisions: backfill go-ahead, delete duplicate, rip magic link,
identity cleanup defer, helm inbox yes. Executed all four.

**1. `slug_email:*` backfill — no-op.** Only one published one-sheet
exists in production (`onesheet:jiwon`), and it was published after
Task 4 shipped so the mapping was already in place. Nothing to backfill.

**2. Nested clone deletion.** `~/helmos/helmos/` (17MB local duplicate)
removed via `rm -rf`. Untracked anyway, no git/data impact.

**3. Magic-link rip-out.** Per HELM_CONTEXT.md's claim ("removed") that
turned out not to be true — the UI and routes were still live. Now
fully gone:
- Deleted `app/api/auth/magic/` (send + verify routes)
- Removed Magic Link tab + handler from homepage; simplified to a
  single password form
- Removed "Prefer magic link?" link from `/login`; replaced with
  "Forgot or never set your password?"
- Cleaned 2 orphaned `magic:*` tokens from KV
- Updated stale comments in `intake/route.ts`, `update-artist/route.ts`,
  `lib/auth.ts`

**4. Helm-hosted inbox (`feat(inbox)`).**

   A) **Privacy fix.** Previously, inbound emails to `slug@helmos.co`
   were forwarded full-content to the artist's real email with
   `Reply-To` set to the original sender. The artist replying from
   their mail client leaked their real `From:` address. Now: the
   forwarded copy is a short NOTIFICATION ONLY (sender + subject +
   120-char preview + deep-link button), no body, no Reply-To. Artist
   replies inside Helm via the existing modal (sends from
   `slug@helmos.co`).

   B) **Read/unread state.**
   - `InboundEmail` gains optional `read` field.
   - NEW `POST /api/helm/outreach/inbox/read` — batch-mark by ID.
   - Inbox UI: unread messages get purple dot + accented border +
     bolder text; click anywhere on a message to mark read; unread
     count chip in the header.

   C) **Deep-link from notification.** Notification email points to
   `/dashboard?tab=outreach#inbox`; dashboard now honors `?tab=` to
   open the right tab; `#inbox` anchor scrolls into view.

**Still pending:**
- Identity cleanup (deferred per Rory).
- Threaded conversation view (inbound + outbound on one timeline) —
  worth doing later but not asked for yet.

---

## 2026-05-14 — Followup batch: tech debt + shows UI

Rory said "fix all this" to the followups I listed. Shipped five
commits to `feat/password-reset`:

**1. `fix(middleware)` — unblocks local `npm run dev`.** Previous
middleware used Node `crypto.createHmac()` inside an Edge runtime,
returning 500 on every dev page. The dev-auto-login was also using
fake credentials (`dev-artist`/`cus_dev`) that couldn't load real
data — the "convenience" was illusory. Replaced with a no-op +
comment explaining what was there and why we removed it.

**2. `fix(dashboard)` — removed ~45 lines of unreachable dead code**
in `handleRoyaltyAudit` that had an early return followed by the
prior streaming implementation. Fixed the 4 pre-existing
`artistData possibly null` TS errors as a side effect. useCallback
deps array now matches actual usage (exhaustive-deps satisfied).

**3. `refactor(auth)` — DRY'd up the auth duplication.**
   - NEW `lib/password.ts`: `hexEncode`, `hashPassword`,
     `makeNewPasswordRecord`, `verifyPassword` + `PasswordRecord` type.
   - NEW `lib/auth.ts`: `buildSessionAndRedirect` shared by every
     auth route that issues a session.
   - `app/api/auth/password/route.ts` and
     `app/api/auth/reset-password/confirm/route.ts` now import from
     lib instead of redefining locally.
   - ~110 fewer lines net. Magic-verify route still has its own
     inline copy — left untouched per surgical-changes principle.

**4. `fix(chat)` — unified TAG-OR-IT-DIDN'T-HAPPEN rule across all
action tags.** Yesterday's GENERATE RULE only covered `<generate>`,
and the prior EMAIL SENDING RULE only covered `<send-email>`.
`<save-show>` and `<book-shows>` were vulnerable to the same lying
pattern. Replaced both per-tag rules with a single UNIVERSAL RULE
plus per-tag specifics. Less prompt real estate, clearer policy.

**5. `feat(dashboard)` — UI to manage saved shows.** New
`UpcomingShowsCard` component in the Links tab. Lists, adds, deletes
shows via the same `/api/helm/onesheet/shows` endpoint the chat uses.
Artists can now manage shows without going through chat.

### Still owed (needs Rory's input or action — not blocked by me)

- **Backfill `helm:slug_email:*`** for users who published their
  one-sheet before Task 4 shipped. Additive KV writes to production.
  Awaiting blanket approval for this category of additive
  maintenance writes (currently asks per-action).
- **Nested `~/helmos/helmos/` clone removal** — 17MB local-only
  duplicate. Destructive, asking before running.
- **Magic Link UI mismatch** — HELM_CONTEXT.md says "no magic links
  (removed)" but the homepage tab still shows it and the routes still
  work. Product decision: keep + update the doc, or rip out?
- **Identity cleanup** (three GitHub identities: `roryfelton`,
  `hitpiece`, `polytester`) — requires Rory's GitHub org and Vercel
  team admin access.
- **Privacy-preserving email roundtrip** (Task 4 followup) — needs
  product/UX decision on whether to build a Helm-hosted inbox or
  accept that reply-to leaks the artist's real email.

---

## 2026-05-14 — Chat honesty fix + upcoming-shows feature

Rory tested Task 2's "Update One-Sheet" flow on the preview by asking
the chat to add an upcoming show. The bot kept claiming "Regenerating
now" without actually firing `<generate>`, and even if it had, there
was no field for shows on the one-sheet. Two real bugs underneath.

**Fix A — chat lying:** added `GENERATE RULE — TAG OR IT DIDN'T HAPPEN`
to the chat system prompt, modeled on the existing `EMAIL SENDING RULE`.
Tells Claude that the tag IS the generation and to never pretend.

**Fix B — upcoming-shows capability** (full feature):
- `UpcomingShow` type in `lib/types.ts`; `upcomingShows?` field on
  `OneSheetData`.
- NEW `app/api/helm/onesheet/shows/route.ts` — GET / POST / DELETE,
  persists at `helm:artist:{id}:upcoming-shows`, dedupes on date+venue,
  filters past dates on read.
- Publish route reads + includes shows.
- One-sheet display renders an "Upcoming Shows" section.
- System prompt teaches the new `<save-show date="..." venue="..."
  city="..." lineup="..." />` tag with concrete example.
- Dashboard chat handler detects `<save-show>`, POSTs to the new
  endpoint before continuing with the existing `<generate>` flow,
  strips the tag from displayed content.

After this, the exact transcript Rory shared produces both a
`<save-show>` AND a `<generate type="one-sheet" />` and the show
appears on the one-sheet.

**Follow-ups:**
- A UI panel to view/edit/delete saved shows from the dashboard (Links
  tab or a new Shows tab). Currently shows are only manageable via
  chat or direct API.
- Year handling: if the artist gives a date without a year, the
  prompt instructs Claude to use the next occurrence — worth testing
  edge cases (e.g. "Dec 31").
- The lying pattern likely affects other tags too (e.g. `<book-shows>`,
  `<save-show>` itself). Worth a broader audit of the prompt to ensure
  every action-triggering tag has a TAG-OR-IT-DIDN'T-HAPPEN rule.

---

## 2026-05-13 — Seven-task batch on `feat/password-reset`

After password reset shipped to the branch, Rory queued 7 follow-up tasks
that were added to the same PR rather than separate branches (his
preference: "more updates before merging"). All commits sit on
`feat/password-reset` awaiting review and merge.

### Task 1 — Dashboard skips "Building career plan…" for returning users
**File:** `app/api/analyze/route.ts`
**Bug:** GET `/api/analyze?artistId=X` was reading `helm:analysis:{id}` but
POST only ever wrote `helm:analysis:{id}:{releaseSlug}`. The dashboard's
prefetch always 404'd, forcing every returning-user load into a full
re-analyze cycle and the slow "Building career plan…" screen.
**Fix:** POST now writes to both the versioned key (preserves cache-busting
on new release) and the bare key (serves the prefetch).
**Backfill:** Copied existing versioned-cache entries for 4 artists
(including Rory's `4LyqJpHI1a45aZHIkVRBSQ`) into bare-key form so they
hit the fast path on next login. Verified `GET helmos.co/api/analyze?artistId=…`
now returns 200 in ~414ms.

### Task 2 — "Create One-Sheet" becomes "Update One-Sheet" once published
**File:** `app/dashboard/page.tsx` (OverviewTab Quick Actions)
Already had `hasOneSheet` wired through. Made the first Quick Action
conditional: when `hasOneSheet` is true, label becomes "📝 Update One-Sheet"
and the click sends an open-ended chat prompt asking the user what
specifically to update.

### Task 3 — One-sheet social links + manager email
**Files:** `app/api/helm/onesheet/publish/route.ts`, `app/dashboard/page.tsx`
- Auto-derives Apple Music artist URL from Spotify via Odesli (song.link),
  with iTunes Search fallback by artist name.
- `bookingEmail` now uses `artistEmail(slug)` — the public-facing
  `artistname@helmos.co` alias instead of leaking the user's real email.
- Publish response now includes `managerEmail` and `missingSocials[]`.
- Success modal surfaces the manager email + nudges the user toward the
  Links tab to fill in any missing socials.
- **Skipped:** auto-detect of Instagram/YouTube/TikTok — Spotify API
  doesn't expose these and scraping the artist page is fragile. The
  Links tab already lets users enter them manually.

### Task 4 — Manager email forwarding (code only — infra still needed)
**Files:** `app/api/helm/outreach/webhook/route.ts`,
`app/api/helm/onesheet/publish/route.ts`
- Publish writes a slug→email reverse mapping at `helm:slug_email:{slug}`.
- Inbound webhook (after storing the email in KV) looks up the artist's
  real email via the slug mapping and forwards via Resend:
  - From: `Helm Manager <{slug}@helmos.co>`
  - Reply-To: original sender (so easy reply works from artist's mail
    client; their real address is visible to the sender on reply — proper
    anonymizing roundtrip is a follow-up)
  - Subject prefixed `[Helm]`
  - In-Reply-To header preserved for threading
  - Non-fatal: forwarding errors don't block the inbox store
- **Infra setup still required (Rory, manual):**
  1. Resend dashboard → Inbound → enable for helmos.co
  2. DNS: add `MX 10 inbound.resend.com` on helmos.co
  3. Resend → Webhooks → point inbound webhook at
     `https://helmos.co/api/helm/outreach/webhook`
  4. Set `RESEND_WEBHOOK_SECRET` in Vercel env vars

### Task 5 — Outreach generator skips already-contacted people
**File:** `app/api/helm/outreach/generate/route.ts`
Two layers of defense:
1. Prompt-level: lists the last 50 contacts already reached out to and
   tells Claude to suggest different people.
2. Post-filter: drops any drafts whose email or name+publication tuple
   matches a past `OutreachRecord` in KV.
Response now reports `droppedDuplicates` count.

### Task 6 — Contact-type multi-select before generating outreach
**Files:** `app/dashboard/page.tsx` (OutreachTab),
`app/api/helm/outreach/generate/route.ts`
Chip-row multi-select with 7 options (journalist, playlist curator,
booking agent, A&R, show promoter, music supervisor, radio DJ). Generate
buttons disabled until at least one is picked. Defaults match the
prior hardcoded behavior so existing flows are unchanged.

### Task 7 — "View Press Release" button on Works & Recordings
**Files:** `app/api/helm/generate/route.ts`, `app/api/helm/press-release/route.ts`,
`app/dashboard/page.tsx` (WorksTab)
- Chat-driven press releases now persist to KV (previously only the
  direct POST path saved, and only under email+timestamp keys).
- Both paths now also save to `helm:artist:{id}:press-release:latest`.
- New GET `/api/helm/press-release?artistId=X` returns the latest.
- WorksTab fetches on mount; if a press release exists, the latest-release
  card shows a "📰 View Press Release" chip that opens a DocModal with
  the content.

### Followups still owed
- Privacy-preserving email roundtrip (artist's real email never exposed to
  outside senders) — requires an inbox UI in Helm for replies.
- Backfill `helm:slug_email:*` for users who published their one-sheet
  before this change.
- The 4 pre-existing TS `artistData possibly null` errors in
  `app/dashboard/page.tsx` are still there. Unrelated.
- `hashPassword` / `buildSessionAndRedirect` duplication noted in the
  password-reset entry still pending extraction.
- Pre-existing `middleware.ts:30` Node-`crypto`-in-Edge-runtime bug still
  breaking local `npm run dev` on every page. Production unaffected.

---

## 2026-05-12 — Password reset / first-time setup feature

**Branch:** `feat/password-reset`

**Why:** Rory could not log in to helmos.co — his email (`rory@goodmornmusic.com`) had no `helm:password:` record in KV (Nic had one but Rory never registered). Existing login flow returned a misleading "No account found" error. Per Rory: "we need a password reset feature on the homepage."

**Shipped:**

| Change | File |
|---|---|
| New: `POST /api/auth/reset-password/request` | `app/api/auth/reset-password/request/route.ts` |
| New: `POST /api/auth/reset-password/confirm` | `app/api/auth/reset-password/confirm/route.ts` |
| New: `/forgot-password` page | `app/forgot-password/page.tsx` |
| New: `/reset-password` page | `app/reset-password/page.tsx` |
| Modified: improved misleading login error | `app/api/auth/password/route.ts` |
| Modified: "Forgot password?" link added | `app/page.tsx`, `app/login/page.tsx` |

**Notable decisions:**
- Unified first-time-setup and reset under one flow — same UX, same email.
- Token: 32 random bytes hex-encoded, 1-hour TTL, single-use (deleted on consume).
- Sender: `signin@helmos.co` (reuses the Resend-verified domain pattern from magic links).
- No explicit rate limiting — matches magic-link pattern. Relies on Resend account limits + subscription requirement + email-enumeration prevention.
- Reset URL uses request origin so links work on Vercel preview deploys.
- Email enumeration prevented: `/request` always returns `{ok: true}` regardless of whether the email matches a subscriber.

**Verification:**
- `tsc --noEmit`: clean for new code (4 pre-existing errors in `app/dashboard/page.tsx:3345-3356` unchanged).
- `npm run build`: succeeds. Both new pages compile to static (`/forgot-password` 1.41kB, `/reset-password` 1.62kB).
- API smoke tests (11 curl cases): all return expected status codes.
- UI smoke test deferred to Vercel preview (see pre-existing bug below).

**Follow-ups (not in this PR):**

1. **`hashPassword` / `hexEncode` duplication** — now lives in both `app/api/auth/password/route.ts` and `app/api/auth/reset-password/confirm/route.ts`. Extract to `lib/password.ts` next time we touch auth.
2. **`buildSessionAndRedirect` duplication** — same logic now lives in password register, password login, magic verify, and reset-password confirm. Extract to `lib/auth.ts`.
3. **Pre-existing bug in `middleware.ts:30`** — calls `encodeSession()` which uses Node `crypto.createHmac()`. Middleware runs on Edge runtime which doesn't support Node `crypto`. Effect: `npm run dev` returns **500 on every page** locally. Production is unaffected because `middleware.ts:14` short-circuits when `NODE_ENV=production`. Fix: replace Node `crypto` with Web Crypto API in `lib/session.ts`. This is the reason no one has been testing locally lately.
4. **Pre-existing TS errors** — `app/dashboard/page.tsx:3345-3356` has 4 `artistData possibly null` errors. Not from this PR.
5. **Nested clone** — `~/helmos/helmos/` is a 17MB untracked duplicate. Safe to remove: `rm -rf ~/helmos/helmos`.
6. **Magic Link UI vs HELM_CONTEXT.md** — `HELM_CONTEXT.md` says "no magic links (removed)" but the homepage and code both show magic link as a fully working tab. Either the doc is stale (likely) or magic link should be ripped out. Confirm with Rory.

---
