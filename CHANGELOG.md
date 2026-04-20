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








