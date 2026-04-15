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




