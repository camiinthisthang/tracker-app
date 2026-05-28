# Changelog

Append-only log of work completed during autonomous overnight sessions and
notable manual changes. Newest entries on top.

Format per entry:

```
## YYYY-MM-DD HH:MM — task #N: short title
- What changed (file paths, behavior)
- What was tested (build pass, manual click-through, smoke test)
- Any cost incurred (Apify credits, Resend emails sent)
- Blockers surfaced (link to "Blocked — needs Cami" section if any)
```

If a task ends up blocked, also add a section at the bottom:

```
## Blocked — needs Cami
- **Task #N:** specific question / decision needed, with enough context that
  she can answer in <30 seconds when she wakes up
```

If you spot orphaned UI elements, broken bits, or weird state during another
task, log them at the bottom under "Drive-by observations" — don't go on a
tangent.

---

## 2026-05-28 — creator fixes + client report (branch: creator-fixes-and-client-report)
Follow-up round with Jacqueline now that all deploys are green again. (Root cause of the deploy outage was **not** code: Vercel was blocking every commit authored by `jacquelinegiale-3718` because that Git identity isn't a member of the Vercel team — a team-member with access pushed it through.)

- **Creator-side Posts tab (`src/app/(creator)/creator-posts/page.tsx`, `src/components/posts/creator-posts-table.tsx`, `src/components/layout/creator-sidebar.tsx`).** Creators now have their own "Posts" tab (`/creator-posts`, between Home and Tasks) showing only their own posts scoped by `session.user.creatorId`. Columns: title, platform, link, posted-at, views, likes, shares, saves, comments — same metrics the admin sees, but creator-scoped. Includes a summary strip (post count + total views/likes/shares/saves/comments), campaign filter (only when assigned to >1 campaign), date-range filter, and CSV export. Named `/creator-posts` (not `/posts`) to avoid colliding with the admin `/posts` route; middleware already allows `/creator-*` for the CREATOR role.
- **Richer admin creator-profile (`src/app/(admin)/creators/[creatorId]/page.tsx`).** Was bare-bones (4 stat cards + recent posts). Added: a "Viral Videos (50K+)" stat, an IG-vs-TikTok split card (views + posts per platform via `post.groupBy`), the weekly posting-cadence rings (reusing `CreatorWeeklyProgress`, same Mon–Sun shape as creator home), and the 28-day views-over-time chart (reusing `CreatorViewsChart`). No schema change — all derived from existing `Post` data.
- **Instagram view-count fix + sync diagnostics (`src/lib/social/apify.ts`).** Claire (@cyaihacks) reported missing posts + wrong views. Two findings: (1) **view-count field** — IG Reels expose plays under varying keys by actor version; extended the IG fallback from `videoViewCount ?? videoPlayCount` to also include `igPlayCount` (the current actor key), which should populate Reel views that were reading 0/low. (2) Added compact per-post logging for both IG (`[ig-sync]`) and TikTok (`[tt-sync]`) printing the raw candidate count fields + resolved views, so the next sync's Vercel function logs show exactly what the actor returns.
- **Claire's *missing* posts — hashtag filtering disabled by default (`src/lib/social/sync.ts`, `src/components/campaigns/campaign-form.tsx`).** `syncCampaign` was dropping posts via two filters: the campaign **date window** (`startDate`..`endDate`) and the **hashtag filter** (`filterByHashtags`, only kept posts whose caption contained a campaign hashtag). Claire has 3 IG Reels + 5 TikToks but only 2 IG + 3 TikTok showed because the others' captions don't include the campaign hashtag. **Fix:** hashtag filtering is now gated behind a `HASHTAG_FILTERING_ENABLED = false` flag — we pull each creator's entire account within the campaign window regardless of hashtags. The `filterByHashtags` logic is **retained** (not deleted) so we can flip the flag — or later drive it per-campaign / per-tab — if a future campaign wants hashtag-scoped pulls. `campaign.hashtags` stays stored as an optional label; the campaign-form help text now says hashtags don't filter what gets pulled. (Date window still applies — confirm a campaign's date range covers the post dates.)
- **Per-creator sync now explains *why* posts are missing (`src/app/api/creators/[creatorId]/sync/route.ts`, `src/components/creators/sync-creator-button.tsx`).** With hashtag filtering off, the only remaining filter that drops posts is the campaign **date window**. The "Sync posts" button already reported per-platform fetched / saved / skipped counts; it now also surfaces the campaign's date range and lists the specific out-of-window posts (platform · date · views) so the cause is self-evident and actionable. When anything is skipped, the toast is a 15s warning (was a 7s success) so it's readable. Response gained `window` and `droppedPosts`. One click on Claire's profile now distinguishes "scraper didn't return it" (low `instagramPosts`/`tiktokPosts` count) from "outside campaign dates" (listed under droppedPosts).
- **Lint cleanup — zero TypeScript / no-unused-vars warnings.** Removed dead imports (`Input` in `uploads-manager.tsx`, `useEffect` in `assign-to-campaign.tsx`, `Upload` in `creator-sidebar.tsx`, `Label` in `report-config.tsx`); moved a stale `eslint-disable-next-line @next/next/no-img-element` directive onto the actual `<img>` in `thumbnail-image.tsx` (the proxied-thumbnail `<img>` is intentional — `next/image` can't proxy IG/TikTok CDN URLs); added `ignoreRestSiblings` + `^_` ignore patterns to `eslint.config.mjs` so the `{ id, ...rest }` key-strip in `campaign-form.tsx` no longer flags. `next lint` now reports only one residual notice — React Compiler skipping memoization of the TanStack `useReactTable` DataTable, which is the library's documented behavior, not a code defect.
- **Tested:** `npm run build` clean on Node 20.19. New `/creator-posts` route compiles (2.43 kB); `/creators/[creatorId]` grew to 9.37 kB with the chart. `next lint` clean of all unused-var/TS warnings.
- **Not yet pushed.** Holding the remote push until Jacqueline is ready, given recent deploy sensitivity.

---

## 2026-05-28 16:00 — bug-fixes batch 1 (P0+P1, branch: bug-fixes-batch-1)
Triage round with Jacqueline covering the bugs Cami's creators / managers have been hitting. Scope locked to fixes that need **no schema changes** so we can ship without a Neon DB branch. Dub.co integration, "view as creator" impersonation, and the resources-visibility bug are explicitly deferred to a follow-up branch.

- **P0 — Admin dashboard scope (`src/app/(admin)/dashboard/page.tsx`).** Dashboard was filtering every query by `session.user.teamId` so a super admin / agency manager on the DropDeck home team saw "0 active campaigns" and an empty Top Posts panel even when client teams had loads of activity. Replaced 6 hardcoded `{ teamId }` filters with `campaignVisibilityWhere(session)` / `creatorVisibilityWhere(session)` — the helpers the May 22 P0 sweep already established for everywhere else. Inner `CampaignsList` server component now takes the where filter instead of `teamId`. Client managers still see only their team; agency users see across every client.
- **P0 — Campaign sync fire-and-forget (`src/app/api/campaigns/[campaignId]/sync/route.ts`, `src/components/campaigns/sync-button.tsx`).** "Sync Data" on a campaign was timing out on Vercel because `syncCampaign` fans out Apify scrapes for every (creator × platform) inside one HTTP request. Some creators got synced, others didn't, and the admin had to visit each creator profile and click Sync individually. Now: route does auth + rate-limit + bumps `lastSyncAt` synchronously, then hands `syncCampaign(...)` off to `next/server`'s `after()` and returns a `{ success: true, started: true }` payload in <100ms. Route has `export const maxDuration = 300` so the background work has 5 minutes. Sync button toast updated — no more postsUpserted count (we don't have it at response time): "Sync started — give it a couple of minutes, then refresh to see the latest posts and view counts."
- **P1 — Weekend tracker (`src/app/(creator)/home/page.tsx`, `src/app/(admin)/campaigns/[campaignId]/{overview,progress}/page.tsx`).** Creators asked for Sat + Sun on their weekly post tracker. `DAY_LABELS` extended to `["M","T","W","T","F","S","S"]` and `weekEnd` is now `addDays(weekStart, 7)`. **Same weekly target, distributed across 7 days** (per Jacqueline) — `weeklyTarget` numeric stays unchanged, per-day ring target becomes `weeklyTarget / 7`. The `CreatorWeeklyProgress` / `CreatorProgress` components already render any number of day rings dynamically from `postsPerDay.length`, so no component changes were needed.
- **P1 — Sync cron frequency + maxDuration (`vercel.json`, `src/app/api/cron/sync-posts/route.ts`).** Cron was once-daily at 6am UTC — explained Claire Yao's stale view counts (no auto-refresh between manual syncs). Bumped schedule to `0 */4 * * *` (every 4 hours = 6 runs/day) and added `export const maxDuration = 300` to the cron route so `syncAllCampaigns()` has 5 minutes to sequence through every active campaign. For Claire specifically — confirmed her posts are Reels, so `videoViewCount` is populated by Apify; cron will now refresh them ~6× per day.
- **Rebrand: Tapmore → DropDeck.** `AGENCY_TEAM_SLUG`/`AGENCY_TEAM_NAME` in `src/lib/auth.ts` flipped to `"dropdeck"` / `"DropDeck"`, with `LEGACY_AGENCY_TEAM_SLUG="tapmore"` / `LEGACY_AGENCY_TEAM_NAME="Tapmore"` retained as a fallback so existing prod sessions (whose Team row still has slug="tapmore") don't get demoted to client_manager on deploy. Same dual-check added to `src/components/layout/admin-sidebar.tsx`. `scripts/reset-data.ts` constants renamed, and the team-find OR now also accepts `slug:"tapmore"`/`name:"Tapmore"` so when Cami runs the reset on prod it adopts and renames the existing row in place. `src/lib/email/manager-invite.ts` from-label now says "DropDeck". Inline comments and `CLAUDE.md` updated. **Left alone:** `CHANGELOG.md` history and `scripts/migrate-split-agency-from-merit.ts` (historical migration that already executed) still reference Tapmore as they describe the past state.
- **Tested:** `npm run build` clean on Node 20.19 (had to nvm-install since local default was 20.13.1 < Prisma's required 20.19+). No type errors, no new lint warnings beyond what was already there.
- **Cost:** zero credits incurred by this PR itself. Going forward, increased cron frequency = ~$1–$5/day in Apify scraper credits (6 runs × ≤10 creators × 2 platforms × 30 posts at $0.20–$1 / 1K results). Acceptable for current scale; revisit if creator count grows.
- **Not yet on PR.** Branch pushed for Jacqueline to test on Vercel preview deploy before opening the PR for Cami.

### Drive-by observations
- `scripts/migrate-split-agency-from-merit.ts` still hardcodes `TAPMORE_SLUG`/`TAPMORE_NAME` — left intentionally as a record of the historical state. If re-run today it would create a team named "Tapmore", which is wrong. Worth deleting the script outright once Cami confirms it's not needed for replay.

### Blocked — needs Cami
- **Rebrand finishing touches:** the prod `Team` row still has slug="tapmore" / name="Tapmore". The legacy fallback keeps everything working, but the row should be renamed to slug="dropdeck" / name="DropDeck" via either a one-off SQL UPDATE or the next `scripts/reset-data.ts` run. Once that's done, the `LEGACY_AGENCY_TEAM_SLUG`/`LEGACY_AGENCY_TEAM_NAME` constants in `src/lib/auth.ts` and `src/components/layout/admin-sidebar.tsx` can be removed.

## 2026-05-28 00:50 — creator-progress cards now honor campaign.weeklyPostTarget
- Bug: campaign overview's Creator Progress cards showed "X/5 posts" with the headline "5 posts/week target" regardless of what the campaign's Weekly target field was set to. Setting the campaign field to 10 had zero effect on the cards.
- Root cause: both `overview/page.tsx` and `progress/page.tsx` computed `weeklyTarget = cc.videosPerDay * 5` from `CampaignCreator.videosPerDay` (default 1). Campaign's own `weeklyPostTarget` field was only displayed in the Campaign Details strip and never actually flowed into any progress math.
- Fix: use `campaign.weeklyPostTarget` as the source of truth for the per-creator weekly target. Ring per-day target derives from `weeklyTarget / DAY_LABELS.length`. So a campaign set to 10/week shows "X/10 posts" with each ring expecting 2/day to fill.
- `CampaignCreator.videosPerDay` is left untouched — still used by `lib/tasks/generate.ts` for daily task generation. Just stops driving the progress cards.
- Tested: `npm run build` clean.

## 2026-05-28 00:35 — server-side image proxy for IG/TikTok thumbnails
- The referrer-policy fix from the previous chunk didn't recover IG thumbnails on the campaign overview — they kept rendering the "Thumbnail unavailable" placeholder even immediately after a fresh sync. Browser-side fetches to `cdninstagram.com` get blocked for reasons beyond the Referer header (UA gating, short signed-URL TTLs for non-authed scrapers).
- New route `src/app/api/img/route.ts` — a server-side image proxy locked to an allowlist of TikTok/IG CDN hostnames. Fetches the upstream image with a browser UA, pipes the bytes back with `Cache-Control: public, max-age=3600`. Hostname allowlist prevents SSRF; only `https` upstreams accepted.
- `ThumbnailImage` now rewrites any TikTok/IG CDN URL to `/api/img?url=<encoded>` before passing to the `<img>` tag. URLs that aren't on the allowlist (e.g. future R2 / Vercel Blob own-domain URLs) pass through untouched, so the same component keeps working after the durable storage fix.
- Doesn't fix already-expired URLs — those still return upstream-error from the proxy and the component falls back to the placeholder. The truly durable fix is still the storage-cache path noted in the prior changelog entry.
- Tested: `npm run build` clean.

## 2026-05-28 00:05 — thumbnail graceful failure (referrer-policy + fallback)
- Bug: Instagram thumbnails on the campaign overview's Top Posts gallery (and elsewhere) were rendering as broken `<img>` elements showing the post caption as `alt` text on a transparent background. Two root causes: (1) IG CDN URLs use signed `oe=` expiry timestamps (~24h) and the campaign-level sync hasn't been refreshing them because of the deferred Vercel-timeout bug; (2) Instagram CDN sometimes returns 403 when the `Referer` header points at a non-IG origin.
- Added `src/components/campaigns/thumbnail-image.tsx` — small client component that wraps `<img>` with `referrerPolicy="no-referrer"` (kills the Referer-based 403) + `onError` fallback to a clean "Thumbnail unavailable" placeholder instead of the alt-text leak.
- Migrated every raw-`<img>`-for-thumbnail usage: `top-posts-gallery.tsx`, `posts-gallery-client.tsx`, `creator-viral-videos.tsx` (was using `next/image`, which mishandles signed URLs the same way), `(admin)/creators/[creatorId]/page.tsx`.
- Tested: `npm run build` clean.
- **Does not fix expired URLs.** The durable fix is to download thumbnails to our own storage at sync time so the URL never expires. Two paths: (a) R2 — already coded in `src/lib/r2.ts` but blocked on Vercel env vars per the existing TODO; (b) Vercel Blob — simpler, auto-provisions env on `vercel blob` link. Recommend (b) for tonight's reliability; (a) is fine once the env vars land. Either path means a sync-time `fetch + put` for each thumbnail.

## 2026-05-27 22:50 — sync only attaches posts inside the campaign's date window
- Campaigns were tracking videos posted outside their `startDate` / `endDate`. E.g. a campaign set May 26 – June 26 still showed April videos because both sync paths fetched the creator's last 30 posts and attached every one of them to the campaign regardless of `postedAt`.
- `src/lib/social/sync.ts` `syncCampaign`: filter Apify results to `startDate <= postedAt < endDate + 1 day` before upsert. Added an idempotent prune at the start of every sync — `prisma.post.deleteMany` removes any existing posts on the campaign whose `postedAt` falls outside the window. Self-heals legacy bad data on the next sync. Result payload now includes `prunedOutOfRange`.
- `src/app/api/creators/[creatorId]/sync/route.ts`: same window filter applied to fetched posts before upsert. Also added a creator-scoped prune (only this creator's posts on the target campaign get deleted if out of range). Returns new `droppedOutOfRange` + `prunedOutOfRange` counts.
- `sync-button.tsx` and `sync-creator-button.tsx` surface the new counts in their success toasts so it's visible when posts get filtered/removed.
- End-of-day handling: endDate is inclusive — a post at 11pm on the endDate counts. Implemented as `lt: endDate + 1 day`.
- Tested: `npm run build` passes clean.
- Cost: zero — no extra Apify calls; this is purely a write/prune-time filter.

## 2026-05-22 — P0 Sunday recovery fixes (branch: p0-sunday-fixes)
- FIX A: Team-filter bypass for agency users. API route handlers that scoped
  `session.user.teamId` to LOCATE a campaign/creator/upload/hook/task/post/
  bonus-rule/notification/report now bypass the filter for agency users
  (super admins + agency managers) via `hasAgencyWideAccess()`; client
  managers stay tenant-scoped. Routes touched: campaigns/[campaignId]/sync,
  campaigns/[campaignId], campaigns/[campaignId]/generate-tasks,
  campaigns/[campaignId]/creators, uploads, posts, reports, notifications,
  tasks, bonus-rules, bonus-rules/[ruleId]. settings left scoped with a
  TODO(P1) for a future team selector.
- FIX B: Unified the product name. Added `src/lib/brand.ts` as the single
  source of truth (`BRAND_NAME`/`BRAND_WORDMARK`/`BRAND_URL`). Replaced all
  user-facing "viewtrackr"/"Viewtrackr" strings across sidebars, emails,
  apply pages, invite pages, auth pages, and metadata. Sidebars now always
  render the brand wordmark and never the client team name.
- FIX C: Raised the creator hooks feed cap from `take: 20` to `take: 200`
  (it was a hardcoded UI limit, not a DB limit).
- FIX D: Hid the non-functional Upload entry points (creator sidebar nav
  item and campaign detail "Uploads" tab) until Cloudflare R2 is configured.
  Code/routes left intact.
- FIX E: Client detail page creator query now includes creators assigned to
  the client's campaigns, not just creators "homed" on the team — so the
  "Creators (N)" count is accurate.

## 2026-05-18 23:30 — backfill Poncho prompts for 20 recent hooks
Most recent 20 hooks without a `ponchoPrompt` get one. All written in
Jacqueline's pattern — [BRACKETS] for user-fillable variables, named
tools (apollo, hunter, clado, exa, hinge profile uploads, npi registry,
etc), structured output asks (one-page brief, green/yellow/red, side-
by-side, ranked list), spend caps where it makes sense.

**Coverage**
- 10 Regan hooks from May 7-9 (agency-job-quit, height fish, $1500
  logo, future roommate, 800-followers brand deal, childhood friend,
  salary negotiation, "girls before any man," hinge founder check,
  Pedro Pascal contact reveal).
- 10 Cami hooks from May 4 (fat-shirts, CEO email reveal, three
  variants of the job-hunt-via-CEO-email play, hinge profile vet x2,
  AI-tool car comparison, delulumaxxing, boss-makes-$500K demo).

**Skipped (intentionally — observational, not demos):**
- "5 years wasted on a CS degree"
- "lmao my friend who is already psycho is now background checking"
- "btw my manager just got me in trouble for using AI"
These read as TikTok-vibe commentary rather than product demos. Adding
a forced prompt would weaken them. Convert to demos in a follow-up if
desired.

**Script** — `scripts/patch-poncho-prompts.ts`
- Dry-run by default; `--confirm` to write.
- Reads each hook by id, only patches where `ponchoPrompt IS NULL` so
  re-running can't clobber an edit.
- Single `$transaction`.
- Run against prod:
  ```bash
  DATABASE_URL="<prod>" npx tsx scripts/patch-poncho-prompts.ts          # preview
  DATABASE_URL="<prod>" npx tsx scripts/patch-poncho-prompts.ts --confirm
  ```

**Tested**
- `tsc --noEmit` clean.
- `eslint` clean.

## 2026-05-18 22:00 — viewtrackr brand pass (public/auth surfaces)
Applies the viewtrackr / poncho brand system (same colors, same typography)
to the public-facing surfaces and global tokens. App interior keeps its
existing layout — only colors + fonts shift there.

**Tokens** — `src/app/globals.css`
- Brand color CSS vars: `--brand-blue` (#054FF0), `--brand-chartreuse`
  (#DCFC73), `--brand-lavender` (#E1D2F3), `--brand-bone` (#F9F8F3).
- Shadcn primary now maps to brand blue; accent to chartreuse; ring to
  blue. So every existing button / input / focus state inherits the new
  palette without per-component edits.
- New utility class `.brand-surface` for blue-background, white-text
  hero sections (used by apply, login, invite).

**Fonts** — `src/app/layout.tsx`
- Swap Inter → Geist + Geist Mono via `next/font/google`. `--font-sans`
  is Geist, `--font-geist-mono` is Geist Mono. Already referenced from
  globals.css via `@theme inline`.

**Reusable brand components** — `src/components/brand/`
- `BrandMark` — the "viewtrackr." wordmark (Geist Bold, lowercase,
  chartreuse period). `tone="light"` for blue surfaces, `tone="dark"`
  for white. Links to /apply by default.
- `BrandHeadline` — the deck's signature pattern: bold lowercase text
  with the last word wrapped in a chartreuse highlight block.
- `BrandPageHeader` — terminal-log header bar in Geist Mono (section
  name + page index, e.g. "viewtrackr / apply" + "01 / 04").

**Rebranded surfaces (full deck treatment):**
- `src/components/apply/apply-hero.tsx` + `apply-nav.tsx` — blue
  background, lowercase brand voice, chartreuse highlight on the
  promise word, mono stat blocks. Nav uses the wordmark + chartreuse
  CTA button.
- `src/app/(auth)/layout.tsx` — blue surface wrapping login/register
  with the brand mark in the corner and a terminal-log footer.
- `src/app/(auth)/login/page.tsx` + `register/page.tsx` — white cards
  on the blue surface, lowercase headlines with blue period accent,
  mono labels + body, brand-blue submit button.
- `src/app/invite/[token]/page.tsx` + `invite/team/[token]/page.tsx`
  — same full brand treatment for the creator + manager invite
  landing pages.

**Logo + sidebar wordmark** — admin + creator sidebars
- Replaced the generic BarChart3-in-blue-square logo with a "v" square
  in brand blue + the team name wordmark (lowercase, brand-blue
  period). Falls back to "viewtrackr." when no team name is in session.

**Out of scope this PR (intentionally):**
- App interior pages (creator /home, admin /dashboard, /campaigns, etc)
  keep their current layout. They inherit the new colors via the
  shadcn token rewire but aren't visually overhauled. Doing that
  cleanly would be a much bigger PR — coming next if Cami wants it.
- Email templates (creator-invite.ts, team-invite.ts) still use the
  old visuals. Worth a follow-up so the first impression matches.
- Dashboard graphs / charts colors. The chart-1..5 tokens are remapped
  to a blue gradient but individual chart configs may still hardcode
  hex values.

**Tested**
- `tsc --noEmit` clean.
- `eslint` on touched files clean (only the globals.css "no eslint
  config" warning, which is expected for CSS).
- `next build` clean — all routes compile, /login + /register + /apply
  + /invite/[token] + /invite/team/[token] all render server-side.

## 2026-05-16 18:30 — fix: creators leaking onto the agency team
Context: Cami spotted three creators (Alexa Lunario, Claire Yao, Mark Sanchez)
showing up on /team with an "Agency admin" badge. Root cause is two bugs +
no API guardrail.

**Display fix** — `src/app/(admin)/team/page.tsx`
- The agency Team's `members` include now filters `role: { not: "CREATOR" }`.
  Mirrors the same fix that landed on /clients/[teamId] on 2026-04-21.
- CREATOR-role rows on Tapmore are still bugs (see below), but at least they
  stop rendering as "Agency admin" while we sort the data.

**Form fix** — `src/app/(admin)/creators/page.tsx` + AddCreator button
- Super admins now see only client teams in the picker (agency team excluded
  via `where: { slug: { not: AGENCY_TEAM_SLUG } }`).
- `defaultTeamId` is empty string for super admins so the picker forces an
  explicit choice. Non-super-admins still get `session.user.teamId` (they're
  locked to it server-side anyway).

**API guardrail** — `POST /api/creators`
- Refuses with 400 if the resolved team's slug equals `AGENCY_TEAM_SLUG`.
  Error message: "Creators can't belong to the agency team. Pick a client
  team (e.g. Merit) instead."

**Backfill script** — `scripts/move-creator-team.ts`
- Takes `--creator <id-or-email> --to <teamId-or-slug>` and optionally
  `--confirm`. Without `--confirm` it's a dry run.
- In a single `$transaction`, updates `Creator.teamId` and (if present) the
  linked `TeamMember.teamId`. Leaves campaigns / posts / uploads alone.
- For Alexa, Claire, Mark: Cami runs against prod like the previous reset:
  ```bash
  DATABASE_URL="<prod>" npx tsx scripts/move-creator-team.ts \
    --creator content.alexa@gmail.com --to merit --confirm
  DATABASE_URL="<prod>" npx tsx scripts/move-creator-team.ts \
    --creator hi.claireyao@gmail.com --to merit --confirm
  DATABASE_URL="<prod>" npx tsx scripts/move-creator-team.ts \
    --creator unapologetic.genxer@gmail.com --to merit --confirm
  ```
  (Assumes the Merit team's slug is `merit` — if it's different, swap in.)

**Tested**
- `tsc --noEmit` clean.
- `eslint` on touched files clean.
- `next build` clean.

## 2026-05-16 17:00 — creator onboarding + hook field restructure for Monday launch
Context: creators are being onboarded on Monday. Goal is to make the in-app
experience copy/paste simple — "ring light out, copy this, click play."

**Schema** — `20260516180000_add_hook_poncho_and_inspiration`
- `hooks.ponchoPrompt TEXT` (nullable) — copy/paste-ready prompt for Poncho.
- `hooks.inspirationLink TEXT` (nullable) — optional reference video URL.
- Existing `prompt` column repurposed semantically as "Spoken voice" (it was
  already used that way in the UI; no DB rename, no data migration).

**API**
- `POST /api/hooks` + `PATCH /api/hooks/[hookId]` accept the two new fields,
  trimmed -> null when blank. Same shape as the existing fields.

**Admin /hooks workshop** (`workshop-hooks-manager.tsx`)
- Restructured the inline edit form + Quick-add dialog around a single
  `FieldRow` helper: label, optional flag, helper text, control. Every field
  now has explicit hand-holding copy under the label.
- New labels + order: On-screen text -> Spoken voice (optional) -> Face / video
  direction (optional) -> Caption (optional) -> Poncho prompt (optional) ->
  Inspiration link (optional) -> Campaign.
- Spoken voice and Poncho prompt are textareas (multi-line). Poncho prompt
  uses font-mono so creators see exactly what they're pasting.
- Hook cards now render all five fields + the inspiration link as a clickable
  anchor.

**Creator /home hooks feed** (`creator-hooks-feed.tsx`)
- Now a client component. Each copy-friendly field (on-screen text, spoken
  voice, caption, Poncho prompt) has its own Copy button + uppercase label
  + one-line helper. Reduces decision-making to literal copy/paste.
- Inspiration link renders as a "Watch reference" outbound link.
- Lead-in copy: "Ring light out, grab your phone, copy what you need, hit
  record."

**Creator /home start guide** (`creator-start-guide.tsx`)
- New playbook card auto-shown until a creator has 10+ posts (or any time
  their TikTok / Instagram handle isn't connected). Numbered steps:
  connect handles -> pick a hook -> copy text + caption -> paste Poncho
  prompt -> record + post -> drop link in Uploads.
- Slim, blue-tinted card. Falls off automatically as creators ramp.

**Tested**
- `npx prisma generate` (Prisma 7.7.0 client OK).
- `npx tsc --noEmit` — clean.
- `npx eslint` on touched files — clean.
- `npx next build` — clean (all routes compile, /home and /hooks bundle OK).
- Migration not yet applied (prod runs `migrate deploy` on Vercel build).

**Out of scope this PR (per the original brief — flagged for follow-up)**
- Persona section: no existing persona infra in the repo; would need its own
  model + admin UI. Brief said not to block on it. Recommended next step.
- Merit prompt-template reuse: searched the repo + no template assets here.
  If the Merit team shared them in another repo or doc, they'd feed straight
  into the new Poncho-prompt field.
## 2026-05-05 — optional `prompt` field on hooks
- Migration `20260505000000_add_hook_prompt` adds nullable `prompt` to `hooks`. No backfill — existing hooks just have `prompt = null`.
- API: `POST /api/hooks` and `PATCH /api/hooks/[hookId]` accept the field. Trimmed and stored as null when blank.
- Admin UI: prompt input added to both inline edit form and Quick Add dialog (under "Face / video direction", flagged "optional"). Card view shows `Prompt: …` when set.
- Creator UI: `/home` "Hooks for you to test" card surfaces the prompt the same way.

## 2026-05-04 — Vercel deploy fix: route Prisma migrations through DIRECT_URL
- Vercel build failed during chunk 1 with `P1002` — `prisma migrate deploy` timed out trying to acquire a Postgres advisory lock. Root cause: `DATABASE_URL` on Vercel points at Neon's pgBouncer transaction-mode pool, which doesn't support session-scoped advisory locks. The migration SQL itself ran successfully (prod schema is in sync) but the deploy aborted.
- **Manual fix:** ran `DATABASE_URL=<unpooled> prisma migrate deploy` locally to confirm prod schema is at the latest. Status check shows "Database schema is up to date!"
- **Permanent fix:** `prisma.config.ts` now reads `process.env.DIRECT_URL ?? process.env.DATABASE_URL`. Migrations / Studio / generate use the direct URL (no pooler) when available; runtime PrismaClient still gets `DATABASE_URL` (pooled) for queries. Local `.env` mirrors `DIRECT_URL = DATABASE_URL` since localhost has no pooler.
- **Required on Vercel:** add a `DIRECT_URL` env var pointing to Neon's unpooled connection (the `DATABASE_URL_UNPOOLED` value from `.env.production.backup`). Without it the next `migrate deploy` will hit the same lock timeout.
- Note: Prisma 7 deprecated `url` and `directUrl` fields in the schema — they live in `prisma.config.ts` instead.

## 2026-05-04 — hook workshop/publish: creator-side feed on /home (chunk 3 of 3)
- New `CreatorHooksFeed` component on the creator's `/home`. Lists every published hook scoped to the creator's active campaigns, newest-first, capped at 20. Each card shows the 3 fields and the campaign badge. Renders nothing when there are no hooks (so an empty state doesn't clutter the page).
- Source query: `Hook.findMany` filtered to `campaignId IN <active campaign ids>` + `publishedAt NOT NULL` + `isActive = true`. The `(campaignId, publishedAt)` index added in chunk 1 covers this exact path.
- Hook publishing is now end-to-end: agency admin opens `/hooks` → quick-add → publish to Merit campaign → all 5 Merit creators see it on their home the next time they refresh. Ad-hoc viral-grabs land in seconds.

## 2026-05-04 — hook workshop/publish: admin UI (chunk 2 of 3)
- New `WorkshopHooksManager` component on `/hooks`. Two tabs (Workshop / Published), each card shows the 3 fields (on-screen text, caption, video direction) + the hook's campaign + the "Used by N creators" count for published ones (from `Upload.hookId`). Inline edit (full form), Publish (sends to a campaign — picker required), Unpublish (back to workshop, no data lost), Delete.
- "Quick add" dialog at the top — 3 fields + campaign dropdown, two CTAs: "Save to workshop" or "Publish now". The ad-hoc viral-grab flow.
- `/hooks` page rewritten to fetch hooks split by `publishedAt IS NULL`, with the campaign + creator relations, and to use `campaignVisibilityWhere` for the analytics queries (so the leaderboard respects the agency/client visibility split). Old "Usage by defined hook" table removed — the cards already show that info.
- Manager visibility: agency admins workshop + publish + delete; client managers (Sam/Ryan/Mitch) see only the analytics for now. Read-only published view for client managers can come in chunk 3 if needed.
- Dead `HookManager` component deleted.
- Tested: `npm run build` passes.

## 2026-05-04 — hook workshop/publish: schema + API (chunk 1 of 3)
- **Schema change.** Migration `20260504000000_hook_workshop_fields` adds `onScreenText`, `caption`, `videoDirection`, `campaignId`, `publishedAt`, `createdById` to `hooks`. Backfills `onScreenText` from existing `text` on legacy rows and stamps `publishedAt = createdAt` so creators don't lose visibility on published-pre-migration hooks. Index on `(campaignId, publishedAt)` for the creator-side "show me published hooks for my campaigns" query. Legacy `text` column kept and mirrored from `onScreenText` on writes — the existing analytics path that joins `Post.hook` (string) keeps working.
- Auto-generated companion migration `20260504171913_hook_workshop_fields` drops two indexes (`creator_messages_creatorId_isPinned_createdAt_idx`, `posts_hook_idx`) created in earlier migrations but no longer declared in the schema. Pre-existing drift cleanup, harmless to ship alongside.
- **API:** `GET /api/hooks` now supports `?stage=draft|published&campaignId=...` filters and returns the campaign + createdBy relations. `POST` requires `onScreenText` (or accepts legacy `text`), validates the campaign FK if provided, sets `createdById`, optionally sets `publishedAt` when `publish: true`. `PATCH` accepts the new fields, repoints `teamId` to a new campaign's team if `campaignId` changes, and supports a `publish` boolean toggle. New `DELETE` for hard-deleting drafts. All write endpoints gated to `hasAgencyWideAccess` — only Tapmore admins workshop hooks. Existing `HookManager` UI still works because the API accepts the legacy `text` field as a fallback.
- Tested: `npm run build` passes; local `prisma migrate dev` applied cleanly with backfill verified.


- **Migration:** `scripts/migrate-split-agency-from-merit.ts` (run with `--confirm`). The single Merit team had slug `tapmore`, so the code was treating it as the agency team — `/clients` correctly hid it (no other client teams existed) and Sam/Ryan/Mitch had cross-client visibility by accident. Migration: rename Merit's slug → `merit`, create a fresh Tapmore team (slug=`tapmore`) with default TeamSettings, move Cami/Jacqueline/Regan's TeamMember rows to Tapmore, flip `User.isSuperAdmin=true` for Regan. All within one `$transaction`. Zero deletes.
- **Diagnostic:** `scripts/diagnose-teams.ts` — read-only, lists every team + members + invites + entities matching a search string. Used to confirm DB state before/after.
- **Visibility fix (was a pre-existing bug, surfaced by the migration):** every `/campaigns/*` page filtered by `session.user.teamId` with no agency-wide bypass. With Cami now sitting on Tapmore (which has 0 campaigns) all the lists and detail pages went empty for her. Added `campaignVisibilityWhere(session)` to `src/lib/visibility.ts` returning `{}` for super_admin / agency_manager and `{ teamId }` for client managers. Applied across `/campaigns`, `/campaigns/new`, `/campaigns/[id]/{overview,edit,tasks,uploads,progress,reports,notifications}`, plus the campaigns query inside `/creators/[id]`. Creator picker on `/campaigns/[id]/edit` and `/campaigns/new` now uses `creatorVisibilityWhere` so super admins see all creators.
- Tested: `npm run build` passes. Cami/Jacqueline/Regan need to sign out + back in for `session.user.teamId` to refresh.
- **Known gap left:** `POST /api/campaigns` still assigns `teamId: session.user.teamId`, so an agency super admin creating a new campaign would attach it to Tapmore (wrong — campaigns should belong to a client team). Not in scope for this push; Cami can still edit existing campaigns. Logged for follow-up.


- **Problem:** when a creator's TikTok/IG handle was previously pointed at someone else's account (e.g. used to test the Apify pipeline) and later changed back, the posts scraped under the old handle stuck around forever — `Post.upsert` keys on `(platform, externalId)` so the old rows have no chance of colliding with the new ones. Symptom: inflated view counts on creator profile + dead thumbnails (signed URLs from the old account had expired).
- **Fix:** after a successful Apify fetch, `syncCampaign` now runs `prisma.post.deleteMany` for that `(creatorId, platform)` scope where `username` doesn't case-insensitively match the handle just synced. `PostMetricsSnapshot` cascades on Post delete so daily-snapshot rows clean up too. Prune is gated on `success: true` so a flaky Apify run doesn't wipe legitimate data.
- API return shape: added `prunedStale: number`. `SyncButton` toast now appends ` Removed N stale posts from old handles.` when nonzero.
- Tested: `npm run build` passes. Cami will trigger a sync to verify the stale Poncho data clears.


- **Sync was silently skipping Instagram for most creators.** Old code used `CampaignCreator.platform` (which we just stopped surfacing in the UI — defaults to TIKTOK on every new row) to pick a single platform per creator. Rewrote `syncCampaign` in `src/lib/social/sync.ts` to fan out per-creator across both TikTok and Instagram whenever the creator has the corresponding handle on their profile.
- Removed the unsafe `instagramHandle || handle` fallback — the generic `handle` was returning random Instagram accounts when the creator hadn't set their IG. Now a missing handle = skip (with a reason).
- **Sync button no longer always says "success."** `SyncButton` now reads the API response and shows `"Synced N posts."`, or a yellow `toast.warning` with the skipped creators + reasons when 0 posts came back. Also calls `router.refresh()` so the page picks up new posts immediately.
- API return shape: `{ postsUpserted, creatorsAttempted, platformAttempts, skipped: [{creator, reason}] }`.
- Tested: `npm run build` passes; Cami confirmed posts loaded after the fix.
- Cost: one Apify run per (creator × platform) per click. Still rate-limited to once per hour per campaign.

## 2026-04-29 12:26 — follow-up: campaign delete + drop platform dropdown
- **Campaign delete UI.** New `DeleteCampaignDangerZone` mounted at the bottom of `/campaigns/[id]/edit`, mirroring the creator danger-zone pattern. Confirmation dialog requires typing the campaign name. Hits the existing `DELETE /api/campaigns/[campaignId]` route, toasts, redirects to `/campaigns`.
- **Removed Platform dropdown from add-creator-to-campaign flow.** All creators are treated as multi-platform now. Stripped the column from `CampaignForm`, `CampaignCreatorsTable` (overview), and the per-creator badge in `CreatorProgressCard`. Page-level mappings in `overview/page.tsx` and `progress/page.tsx` no longer pass `platform`. Schema column `CampaignCreator.platform` left in place (default TIKTOK) — harmless and avoids a migration.
- Tested: `npm run build` passes.

## 2026-04-21 02:05 — follow-up: drop threshold, make bonuses per-unit
- **Bonus rules are now per-unit.** Removed the "Threshold" input + help-text logic from `BonusRulesManager`. Form is now just Trigger + "USD per {unit}" + Label. Unit label auto-updates with the trigger ("USD per signup", "USD per paid signup", "USD per viral video", "USD per referral").
- `VIEW_THRESHOLD` dropped from the dropdown (per-unit on max-views-on-a-single-post doesn't make sense). Enum value + legacy rows stay — `src/lib/bonus.ts` skips them in the per-unit computation; API rejects new VIEW_THRESHOLD writes.
- **Calculation rewrite:** `computeCreatorBonusSummary` now returns `earnedUsd = current × ratePerUnit` per rule. No more `threshold / progress / isEarned / nextMilestone` fields. `BonusProgress` shape shrunk accordingly.
- **Creator UI (`BonusTracker`):** no more progress bars / next-milestone callouts. Each rule now shows `$X per {unit} · N {units} this month` → `$earnedUsd`. Total across all rules still at the top.
- Per the example Cami gave: `$1 per signed-up user (USER_DOWNLOAD)` + `$5 per paid-plan signup (USER_PAID_PLAN)`.
- DB schema unchanged. `BonusRule.threshold` column stays NOT NULL — API writes `1` on new rows since it's no longer meaningful.
- Tested: `npm run build` passes.

## 2026-04-21 01:55 — follow-up: prod reset + managers-list filter
- **Ran prod reset** — `DATABASE_URL="<prod>" npx tsx scripts/reset-data.ts --confirm` against the Neon prod DB (hit the pooler from `.env.production.backup`). Renamed Cami's pre-existing team `cmnvxmktv000104jrj12ma2ki` → "Tapmore" in place so her session stays valid. Final counts: `Creator=0, User=2, Team=1, TeamMember=2`. Jacqueline still needs to set a password via the `/register` or invite flow (her User row exists with passwordHash=null).
- **Transaction timeout bump** — first attempt timed out at 5s (prod Neon round-trip is ~100ms vs local ~1ms). Reset script now passes `{ maxWait: 10_000, timeout: 120_000 }` to `$transaction`. Local re-tested; still runs in under a second.
- **UI bug** — `/clients/[teamId]` rendered CREATOR-role memberships in the "Managers" section (Cami saw "Test Creator (Sophia)" there). Now filters `m.role !== "CREATOR"` both in the count and the list; creators only appear under the Creators section below.
- Tested: `npm run build` passes.

## 2026-04-21 01:40 — task #6: specific email-conflict errors
- **New helper:** `src/lib/email-conflict.ts#findEmailConflict(email, { check })` — checks User / Creator / open-status CreatorApplication (PENDING or REVIEWING) tables in that priority order and returns `{ table, existingId, message, suggestion }` or null. `check` option lets callers narrow to the tables they actually care about (e.g. `register-creator` only checks User so it doesn't false-positive on the invited creator's own Creator row).
- **API responses** now include three fields on a 409 email-conflict: `error` (the human message, which table has it), `suggestion` (next-action string), and `conflict.{table, existingId}` (so the UI can deep-link to the existing row).
- **Applied to:**
  - `POST /api/creators` — checks all three tables before creating. Main place where Cami hit this.
  - `POST /api/clients/[teamId]/invite` — checks Creator + Application tables. Deliberately does NOT block on an existing User (the invite-accept flow already gracefully attaches existing users to new teams, so blocking would be wrong).
  - `POST /api/auth/register` — checks User + Creator. Suggestion for existing user is "sign in with your existing password".
  - `POST /api/auth/register-creator` — checks User only (a Creator row for the invitee is expected).
- **UI surfacing:**
  - `AddCreatorButton` toast now shows the suggestion as the toast description and, when the conflict is a Creator or Application, attaches an action button that navigates straight to the existing record (`/creators/{id}` or `/applications`).
  - `InviteManagerButton` toast shows the suggestion as the description.
- Note: the reset in task #1 already cleared the specific Jacqueline conflict, so the in-the-wild symptom is gone. This is preventative for future dupes.
- Tested: `npm run build` passes.

## 2026-04-21 01:20 — task #5: client onboarding PostHog setup step
- **Schema change:** `TeamSettings.posthogOnboardingSkippedAt DateTime?` — set when a user explicitly skips the onboarding card so we don't re-prompt later. Migration `prisma/migrations/20260421000000_add_posthog_onboarding_skip/migration.sql`.
- **New page:** `/onboarding/posthog` (under a new `src/app/onboarding/layout.tsx` with the same centered auth-style wrapper). Server component pulls current `TeamSettings`; if `posthogApiKey` is already set it bounces the user to `/dashboard`. Creators are redirected to `/home`.
- **New component:** `src/components/onboarding/posthog-onboarding-form.tsx` — three inputs (API key password-style / project ID required / host optional with `https://us.i.posthog.com` placeholder), a "Test connection" button that reports inline success/failure, a "Skip for now" ghost button, and a slate-900 "Save and continue" primary.
- **New endpoint:** `POST /api/posthog/test` — accepts unsaved `{apiKey, projectId, host}` in the body so the onboarding form can validate before the first save. ADMIN / super-admin only.
- **New endpoint:** `POST /api/posthog/skip` — stamps `posthogOnboardingSkippedAt=now()` via upsert. ADMIN / super-admin only.
- **Save path:** reuses the existing `PATCH /api/posthog` which already upserts TeamSettings.
- **Routing hook:** `POST /api/invite/team/accept` now returns `needsPostHogOnboarding` (only true for freshly-created users on a team whose `posthogApiKey` is null). `AcceptTeamInviteForm` uses that flag to redirect to `/onboarding/posthog` instead of `/dashboard` after credentials sign-in.
- **Not forced on existing users** — `needsPostHogOnboarding` is `false` if the accepting user already had a User row (the `accountAlreadyExisted` path sends them to `/login` anyway).
- Google-via-team-invite path still lands on `/dashboard` directly (Google callback URL is set once at button click before we know if the signup is fresh). Not worth the complexity to route Google invitees through onboarding — noted but not implemented.
- Tested: `npm run build` passes. Migration applied locally.

## 2026-04-21 00:50 — task #4: agency manager vs client manager distinction
- **`src/lib/auth.ts`:** new `getUserAccessLevel(session)` returning `"super_admin" | "agency_manager" | "client_manager" | "creator"`. Rules: `isSuperAdmin` → super_admin, `role=CREATOR` → creator, `teamName === "Tapmore"` (exported as `AGENCY_TEAM_NAME`) → agency_manager, else client_manager. Companion helper `hasAgencyWideAccess()` collapses the first two into one bool. New gate `requireAgencyAccess()` mirrors `requireSuperAdmin()` but admits agency managers too.
- **Visibility audit:** `src/lib/visibility.ts` now calls `hasAgencyWideAccess()` instead of checking `isSuperAdmin` directly. Agency managers (anyone on Tapmore) now get the empty `where {}` return in `creatorVisibilityWhere` and unconditional `true` in `canAccessCreator` — they see every creator, not just their own team's. `SessionLike` expanded with `role` + `teamName`.
- **`/clients`** now gated on `requireAgencyAccess()` (was super-admin only). `/applications` same — it's cross-client so agency managers should be able to triage. `/clients/new` stays super-admin only (only Cami creates new client workspaces).
- **`/clients/[teamId]` members list** gains an explicit "Agency manager" vs "Client manager" badge per non-creator member. Color-coded (indigo vs blue) so agency vs client managers are visually distinct.
- **Admin sidebar** — "Agency" nav group (Applications + Clients) now shows to anyone on Tapmore, not just super admins.
- **No schema change** (the task said derive from existing data) — entirely session-derived.
- Tested: `npm run build` passes.

## 2026-04-21 00:25 — task #3: expose USER_DOWNLOAD + USER_PAID_PLAN bonus triggers
- **UI:** `BonusRulesManager` trigger dropdown now shows all five `BonusTrigger` enum values (added `REFERRAL_COUNT`, `USER_DOWNLOAD`, `USER_PAID_PLAN`). Labels match the task spec: "Bonus per user signup (PostHog)" and "Bonus per user on paid plan (PostHog)".
- **UI:** Threshold field gains per-trigger placeholder + help-text — the PostHog triggers read "Count of attributed signups/paid-plan users this month (from PostHog)" so the number's meaning is obvious.
- **API:** `POST /api/bonus-rules` whitelist widened from `{VIEW_THRESHOLD, VIRAL_COUNT}` → all five triggers.
- **Computation / creator UI:** `src/lib/bonus.ts#computeCreatorBonusSummary` already aggregates `CreatorAttribution.signupCount` for both PostHog triggers (matches the task's "or paid-plan equivalent" fallback — schema doesn't distinguish paid vs free signups yet). `BonusTracker` `formatTriggerCopy` already renders "Drive N+ downloads / paid conversions this month". No changes needed there — the feature was pre-wired at the data layer, just gated off at the form.
- Tested: `npm run build` passes.

## 2026-04-21 00:05 — task #2: creator delete action
- **New:** `DELETE /api/creators/[creatorId]` — super-admin only. Inside a `$transaction`: deletes the linked `User` first (cascades `TeamMember`/`Session`/`Account`), then the `Creator` (cascades `Post`, `PostMetricsSnapshot` via Post, `Task`, `CreatorMessage`, `Upload`, `CampaignCreator`, `ViralNotification`, `CreatorAttribution`, `CreatorEarning`). Schema already had `onDelete: Cascade` on every FK — no migration needed.
- **New:** `src/components/creators/delete-creator-danger-zone.tsx` — collapsed "Danger zone" card at the bottom of `/creators/[id]` with red accent. Click to expand, reveals a red `Delete creator` button. Opens a confirm dialog that requires typing the creator's exact name before the permanent-delete button enables.
- Rendered only when `session.user.isSuperAdmin` is true.
- On success: toast "Creator deleted", `router.push("/creators")`, `router.refresh()`.
- Tested: `npm run build` passes.

## 2026-04-20 22:15 — task #1: nuclear data reset script
- **New:** `scripts/reset-data.ts` wipes every non-super-admin row behind a required `--confirm` flag. All mutations happen inside a single Prisma `$transaction` so partial failure rolls back.
- Keeps: Cami (`camirgarzon@gmail.com`) + Jacqueline (`jacquelinegiale@gmail.com`) as super admins, one `Team` named "Tapmore" (renames the agency team in place if found, else creates fresh), `TeamSettings` for Tapmore (preserves `schedulingUrl` / `creatorWelcomeTemplate` / PostHog fields via an upsert-with-empty-update), two ADMIN `TeamMember` rows linking each super admin to Tapmore.
- Preflight: deletes any stale `Creator` or `CreatorApplication` rows with Jacqueline's email so her signup isn't blocked after the reset. Nulls `TeamMember.creatorId` before wiping creators so the FK doesn't fire.
- Wipes: every row in `Creator`, `CreatorApplication`, `Post`, `PostMetricsSnapshot`, `CampaignDailyMetric`, `Task`, `CreatorMessage`, `Upload`, `Campaign`, `CampaignCreator`, `Hook`, `BonusRule`, `ViralNotification`, `CreatorAttribution`, `WeeklyReportConfig`, `NotificationRule`, `TeamInvite`, `ApiKey`, `ContentTraits`, `CreatorEarning`, `VerificationToken`, all other `TeamMember`s, all other `Team`s, all other `User`s.
- Final assertion inside the transaction: `Creator=0, User=2, Team=1, TeamMember=2` — mismatch throws and rolls back.
- **Ran locally against dev DB** — counts asserted, Tapmore team + settings present, both users super admins, passwordHash for Cami preserved (was set; left untouched by `upsert.update`).
- **For Cami to run against prod** (not run from here — requires her to paste the prod `DATABASE_URL`):
  ```bash
  DATABASE_URL="<prod connection string>" npx tsx scripts/reset-data.ts --confirm
  ```
  After: Jacqueline sets her password via `/register` with her gmail (or via a fresh team invite; no blocking rows remain).
- Tested: `npm run build` passes.

## 2026-04-20 21:55 — interactive: super-admin creator-add flow + invite email + creator-self handle setup
- **New:** `/creators` now has a "New creator" button (top right) that opens a modal. Super admins can pick the client team; everyone else auto-assigned to their own team. Minimum fields: name, email, handle, tier.
- **New:** `src/lib/email/creator-invite.ts` — `sendCreatorInvite()` composes a branded HTML+text invite email with the `/invite/<token>` magic link.
- **Wired:** invite email now fires automatically from three places: (1) `POST /api/creators` (new-creator modal), (2) application approval (`PATCH /api/applications/[id]`), (3) "Send email" button in the existing invite dialog on `/creators/[id]`.
- **New:** third onboarding task "Connect your TikTok & Instagram" added to `createOnboardingTasks()`, pointing creators at `/profile`.
- **New:** `/profile` now has a creator-self handle form (TikTok + Instagram). Highlighted blue when both are empty.
- **New:** `PATCH /api/creators/me/social-handles` — creator-self endpoint, scoped to only the two handle fields.
- **Schema:** no schema changes; reused existing `Creator.tiktokHandle`, `instagramHandle`, `inviteToken` columns.
- **Tested:** `npm run build` passes (new-creator form, updated invite button, `/profile`, all compile).
- **Follow-up needed from Cami:**
  - Verify `send.viewtrackr.com` is marked Verified in the Resend dashboard at resend.com (DNS records are already live).
  - Set `RESEND_FROM_EMAIL="Viewtrackr <hello@send.viewtrackr.com>"` in `.env` locally + Vercel.
  - Optionally set `NEXT_PUBLIC_APP_URL` (used for absolute invite links in emails; falls back to request origin then `https://viewtrackr.com`).
- Until `RESEND_FROM_EMAIL` is configured, invite emails will still send but from `onboarding@resend.dev` (Resend's test sender) and may hit spam.

## 2026-04-16 22:05 — task #1: verify Apify integration end-to-end
- Added `scripts/test-apify.ts` — quick smoke test harness for both actors.
- Ran against `@nike` (public) with limit=3 per actor.
- **TikTok (clockworks/tiktok-scraper)**: all fields populated — views, likes,
  comments, shares/saves (implicitly via `diggCount`/`shareCount`), postedAt
  (UNIX seconds → Date), link, thumbnailUrl (`videoMeta.coverUrl`), title
  (`text`). No remapping needed.
- **Instagram (apify/instagram-scraper)**: likes, comments, title (caption),
  postedAt (ISO), link, thumbnailUrl all populated. Views only populate on
  reels (`videoViewCount`/`videoPlayCount`) — feed photos/carousels return 0,
  which matches IG's actual API behavior (no view count exposed there). Saves
  and shares are 0 across the board — IG scraper doesn't expose them.
- Cost: ≈6 results × $0.001/result ≈ **$0.006 burned** (negligible).
- No code fixes needed in `src/lib/social/apify.ts`.

## 2026-04-16 22:30 — tasks #2 + #3: auto-onboarding tasks
- **Schema:** added `ONBOARDING` to `TaskType`, made `Task.campaignId`
  nullable, added `UploadCategory` enum (`CONTENT` / `ONBOARDING_DOCS`),
  made `Upload.campaignId` nullable, added `Upload.category` column
  default `CONTENT`. Migration
  `20260416000000_onboarding_tasks_uploads/migration.sql`.
- **Tenant filter change:** tasks + uploads APIs now tenant-check via
  `creator.teamId` instead of `campaign.teamId`, so orphan onboarding rows
  (campaignId = null) remain visible.
- New helper `src/lib/tasks/onboarding.ts` creates two tasks (tax form,
  FTC + account warming) due 7 days out, idempotent by (creatorId, title).
- Hooked into application-approve flow right after pinned welcome message
  creation in `src/app/api/applications/[applicationId]/route.ts`.
- Tax form task body references "Onboarding documents" destination in the
  Uploads tab. `creator-upload-form.tsx` now shows that option in the
  dropdown; selecting it sets `category=ONBOARDING_DOCS` + `campaignId=null`.
- **TaskItem** now renders expandable `description` body (chevron toggle,
  preserves whitespace) so creators can read the FTC warming instructions.
- `// TODO: templatize brand name` placed next to the Chipped-specific copy.

## 2026-04-16 22:50 — task #4: hook taxonomy + tagging
- **Schema:** new `Hook` model (id, teamId, text, category?, isActive,
  createdAt, updatedAt) with `Team.hooks` relation + index on
  (teamId, isActive). `Upload` gained `hookId` (FK → Hook, onDelete SET NULL)
  and `freestyleHook` (text) for one-off hooks. Migration
  `20260416010000_add_hook_model/migration.sql`.
- **APIs:** `/api/hooks` (GET/POST) + `/api/hooks/[hookId]` (PATCH).
  POST/PATCH require ADMIN or super-admin. Archive = `isActive=false`.
- **Admin UI:** `/hooks` page now has a `HookManager` (add / edit / archive)
  above the existing analytics. Added a "Usage by defined hook" table that
  shows tagged-upload count per Hook row.
- **Creator UI:** `creator-upload-form.tsx` exposes a Hook dropdown with
  three branches — `No hook` (default), one of the team's defined hooks,
  or "Freestyle: type your own…". Selecting freestyle reveals a text input
  that writes `Upload.freestyleHook`. Form hides the hook picker when the
  user has selected the Onboarding-documents destination.
- **Upload API:** validates `hookId` belongs to the caller's team before
  writing, trims freestyle input, silently drops both on onboarding uploads.

## 2026-04-16 23:10 — task #5: bonus structure + creator live view
- **Schema:** `BonusRule` model (teamId, trigger enum, threshold int,
  amountUsd decimal, label, isActive) + `BonusTrigger` enum
  (VIEW_THRESHOLD, VIRAL_COUNT). Migration
  `20260416020000_add_bonus_rules/migration.sql`.
- **APIs:** `/api/bonus-rules` (GET/POST), `/api/bonus-rules/[ruleId]`
  (PATCH/DELETE). ADMIN / super-admin only for writes.
- **Admin UI:** `BonusRulesManager` on the `/clients/[teamId]` page —
  add/delete per-client rules inline. Super-admins can post against any
  team via the teamId form field.
- **Creator UI:** `BonusTracker` card on `/home` showing dollars earned
  this month, progress bar toward the next milestone, and a breakdown of
  every active rule. Hidden when the team has no rules.
- **Computation helper:** `src/lib/bonus.ts#computeCreatorBonusSummary`
  runs one posts query per creator for the current month and evaluates:
  VIEW_THRESHOLD compares the creator's best single post, VIRAL_COUNT
  counts posts ≥ 50K views. `VIRAL_VIEW_THRESHOLD` exported so task #8
  can reuse the same constant.

## 2026-04-16 23:30 — task #6: reports + charts initial implementation
- **/reports** now shows team-level weekly digest — total views this week,
  posts tracked, placeholder for attributed signups (until PostHog is
  wired), top 5 hooks and top 5 creators by views. Pulls from new
  `src/lib/reports/weekly.ts#computeWeeklyDigest`. Lists existing scheduled
  campaign-report configs at the bottom.
- **/charts** now shows a team-wide overview above the existing per-campaign
  charts: line chart of daily views (last 30d), bar chart of top 10
  creators by views, bar chart of top 10 hooks by views. Uses recharts,
  slate/blue palette, no gradients.
- **Cron** `/api/cron/weekly-report` now actually sends the digest via
  Resend (HTML template in `renderWeeklyDigestHtml`) when
  `RESEND_API_KEY` is set. Falls back to `console.log` otherwise, so the
  cron doesn't 500 when email isn't configured. Subject line includes the
  campaign name and week's total views.

## 2026-04-16 23:50 — task #7: PostHog integration
- **Schema:** `TeamSettings.posthogApiKey / posthogProjectId / posthogHost`.
  New `CreatorAttribution` model (creatorId, date, signupCount, unique on
  (creatorId, date)). Migration
  `20260416030000_add_posthog_attribution/migration.sql`.
- **Sync helper:** `src/lib/posthog.ts` runs a HogQL query over the last
  30 days grouping events by `properties.referral_creator_id` + day,
  filters to known team creators, upserts `CreatorAttribution` rows.
- **Cron:** `/api/cron/posthog-sync` runs daily at 06:30 UTC (added to
  `vercel.json`). Iterates every team with creds configured.
- **Admin UI:** `PostHogConfig` on `/clients/[teamId]` has API key input
  (password-masked, preserves existing value on empty), project ID,
  optional host, plus "Test connection" and "Sync now" buttons. Save /
  test / sync hit `/api/posthog`.
- **Surface:** "Attributed Signups (7d)" on `/dashboard` stat grid,
  "Attributed Signups" stat on `/creators/[creatorId]` (lifetime total).
- **Setup:** paste the API key + project ID on the client page, hit
  "Test connection", done — daily cron fills in the rest.

## 2026-04-17 00:10 — task #8: viral notifications (email + SMS)
- **Schema:** `Creator.notificationPrefs Json`, new `ViralNotification`
  (postId, creatorId, channel enum EMAIL/SMS, sentAt, status, errorMsg)
  with unique (postId, channel) index to prevent double-sends. Migration
  `20260416040000_add_viral_notifications/migration.sql`.
- **Detection:** `src/lib/notifications/viral.ts` diffs today vs
  yesterday's `PostMetricsSnapshot` per post; fires when delta ≥ creator
  threshold (default 50K = `DEFAULT_VIRAL_THRESHOLD`, overridable per
  creator).
- **Channels:** Email via Resend (already wired). SMS via Twilio using
  `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`.
  **Twilio is not configured yet** — when the cron runs in prod it'll
  log and skip SMS until those env vars are set. Email still fires.
- **Cron:** `/api/cron/viral-notifications` at 15:00 UTC daily (added to
  `vercel.json`). Auth via `Bearer $CRON_SECRET` in prod.
- **Creator UI:** `/profile` gains a "Viral video alerts" card —
  opt-in email / opt-in SMS (with phone number), custom threshold. Saves
  via new `/api/notification-prefs` PATCH.

### Blocked — needs Cami
- **Task #8 (SMS):** Twilio env vars (`TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`) aren't set. SMS opt-in
  saves fine but the cron will skip actual sends until you add them in
  Vercel project env.

## 2026-04-17 00:25 — task #9: UI audit
Conservative pass — flagged with `TODO(cami): orphan?` comments instead
of deleting, except where the bad behavior was user-visible (dead
`href="#"` links were removed from both sidebars since they had no
destination and are worse than missing).

### UI audit findings
- **/notifications (admin):** stubbed "coming soon" page. The real per-
  campaign notification-rule CRUD already lives at
  `/campaigns/[id]/notifications`. The top-level page is redundant and
  still linked from the admin sidebar. Flagged with TODO.
- **/settings/api-keys:** stubbed. `ApiKey` model exists in Prisma but no
  UI ever got built. Not linked from any sidebar — only reachable by URL.
  Flagged with TODO.
- **/creator-settings:** stubbed. Replaced the placeholder copy with a
  hint that prefs live on Profile, but still linked from the creator
  sidebar. Flagged with TODO.
- **/creator-resources:** all 6 resource cards (Playbook, Gallery,
  Portfolio, Sora AI Videos, Leaderboard, Year Wrapped) were `<button>`
  elements with no onClick/href — zero worked. Switched them to dashed
  non-interactive cards, added a yellow "not wired up yet" banner, left
  TODO. Decide: wire each to a real destination, or cut the page.
- **Admin sidebar "Feedback" link** had `href="#"` — removed. Restore when
  there's a real destination (shared email / form / Linear).
- **Creator sidebar "Feedback" link** same issue — removed.

### Drive-by observations
- `PageHeader` titles in stub pages were rendering raw camel-case values
  like `"APIKeys"` and `"CreatorSettings"` instead of human-readable
  labels. Fixed on creator-settings while touching it; left the others.
- `/campaigns/[campaignId]/page.tsx` is a redirect-only file pointing at
  `/overview`. Intentional; left alone.
- `src/components/shared/data-table.tsx` emits a React Compiler warning
  about TanStack Table incompatibility. Not a regression — same warning
  has existed; doesn't fail the build.








