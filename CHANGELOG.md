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








