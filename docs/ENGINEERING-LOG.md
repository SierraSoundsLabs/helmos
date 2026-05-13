# Helm Engineering Log

Append-only journal — most recent at the top. Read at the start of each Claude Code session.

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
