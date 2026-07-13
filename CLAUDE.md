@AGENTS.md

# TODO — deferred to later

## Wire Cloudflare R2 for direct video uploads
Code is already in place (`src/lib/r2.ts`, `src/app/api/uploads/presign/route.ts`, tabbed file/link upload form). Idle until these env vars are set on Vercel `tracker-app` Production:

```
R2_ACCOUNT_ID        = Cloudflare account ID
R2_ACCESS_KEY_ID     = token ID from an R2 API token
R2_SECRET_ACCESS_KEY = token secret
R2_BUCKET            = bucket name
R2_PUBLIC_BASE_URL   = https://<r2-dev-subdomain>.r2.dev  OR  custom domain
```

Setup steps:
1. Cloudflare → R2 → create a bucket (e.g. `viewtrackr-uploads`)
2. Bucket → **Public Access** → enable the r2.dev subdomain (or bind a custom domain like `assets.viewtrackr.com`)
3. R2 → **Manage API tokens** → create a token scoped to "Object Read & Write" on that bucket. Copy Access Key ID + Secret.
4. Paste the five vars into Vercel env, redeploy.

Without the env vars, the upload form falls back to link-paste cleanly — no crash. When the vars are set, creators see a file picker + live progress bar and files land in R2 under `teamId/creatorId/<timestamp>-<safe-filename>`.

## Rough idea: detect bonus paid-plan signups separately
Today `USER_PAID_PLAN` uses the same `CreatorAttribution.signupCount` as `USER_DOWNLOAD`. Add a `paidCount` column + PostHog query variant when the paid-bonus clients need it (none do yet).

---

# Current State & Backlog (updated 2026-07-13)

The "Session 2" queue that used to live here is stale — most of it was
superseded by the July 11–13 build-out driven by Jacqueline (see CHANGELOG,
PRs #60–#66+). Status of the old queue:

- ~~Creator delete action~~ — done (danger zone on /creators/[id], super-admin only).
- ~~Client-manager PostHog onboarding~~ — done (/onboarding/posthog).
- Agency vs client manager — partially done (`getUserAccessLevel` / `hasAgencyWideAccess` in src/lib/auth.ts); full visibility audit still open.
- **Nuclear data reset — still open, Cami only.** `scripts/reset-data.ts` was never written; prod still has test data.
- Better "email already in use" errors — still open.
- BonusRule USER_DOWNLOAD/USER_PAID_PLAN dropdown — superseded by per-campaign view-bonus tiers (`campaign_bonus_tiers` + `Campaign.bonusCapUsd`); the team-level per-unit BonusRule system still powers the creator-facing tracker.

## What shipped July 11–13 (high level — details in CHANGELOG)
- Dashboard: date-range filter (24h/7d/14d/90d/custom), campaign switcher, views graph, charts tab, PDF export, green/red deltas.
- Pacing: cumulative monthly goals per campaign (adjustable month start day 1–28, off-pace %, quiet days, viral threshold — all per campaign in the campaign form), Quiet/Off-pace/New/Shadow-ban flags with hover explanations, creators page rebuilt as needs-attention/on-track cards with search + sort.
- Bonuses: per-campaign view tiers + monthly cap, Bonuses Earned card (admin) + bonus potential card (creator side).
- Dark mode toggle (CSS-variable based, scoped to the app shell).
- Tests: vitest, 24 unit tests over src/lib/pacing.ts and src/lib/view-bonus.ts (`npm test`).
- Shadow-ban is per HANDLE (creator_accounts.isShadowbanned, "Mark SB" in Social accounts); the whole-creator flag remains for the rare full-exclusion case.

## Open backlog (in rough priority)
1. Enter real values per campaign (monthly goal, month start day, bonus tiers/cap) — features are live but defaulted.
2. Signups/conversion tracking (Phase 3) — ON HOLD per Jacqueline until a data source exists (dub.co API key or PostHog).
3. Niche dropdown + per-niche bonus tables — waiting on the niche list from campaign managers.
4. Per-creator one-off overrides for bonus tiers and pacing thresholds (currently campaign-wide only) — needs a product decision.
5. TikTok trending sounds (global, not just our creators' posts) — needs an Apify trending-sounds actor + credit budget decision.
6. Timezone-aware day/week/month boundaries (currently UTC).
7. Test coverage for API routes + visibility rules.
8. Nuclear data reset + dupe-email errors from the old queue (Cami).

# Rules

## Workflow
- **Push after every meaningful chunk** — don't batch all 9 tasks into one mega-commit. One push per task or per logical sub-task.
- **Run `npm run build` before every push.** If it fails, debug instead of pushing. Never push a broken build.
- **Update `CHANGELOG.md` on every push.** Format: `## YYYY-MM-DD HH:MM — task #N: short title` then a bulleted list of what changed, what was tested, any cost incurred, and any blockers surfaced.
- **If blocked, move on.** Add a `### Blocked — needs Cami` section to CHANGELOG with the specific question or decision needed, then start the next task. Don't burn budget waiting.

## Code quality
- Match the existing UI design system: slate-800 buttons, blue-500 accents, no gradients in app UI, lots of whitespace. See `/Users/cami/Desktop/Workspace/ugc/CLAUDE.md` and the `.claude/skills/ui-design.md` skill.
- Reuse existing shadcn/ui components — don't reinvent buttons, inputs, dialogs.
- Don't add features beyond what the task requires. No premature abstraction. No "while I'm in here" cleanup.
- Default to writing no comments. Only add when the WHY is non-obvious (constraint, invariant, workaround for a real bug).
- Don't add fallbacks or validation for impossible scenarios. Trust internal code.

## Safety
- Never run `rm` or other destructive commands (already enforced by `--disallowedTools`).
- Never modify `.env` to add or change production secrets without flagging in CHANGELOG.
- For schema changes, always create a migration file (don't `db push` to dev DB and forget). Test the migration applies cleanly on the local DB before pushing.
- Don't burn excessive Apify credits. Use small `resultsPerPage` (3–5) for tests. Cap any new sync code at reasonable per-creator limits.
- Don't commit `.env`, API keys, or any file matching `.env*` (gitignore handles this; double-check anyway).

## Schema changes
- Always create a numbered migration in `prisma/migrations/`.
- For breaking changes, document with a "Schema change" tag in CHANGELOG.
- Migrations auto-apply on prod via `prisma migrate deploy` in the build script.
- For data backfills as part of a migration (like the welcome-template default), put the UPDATE inside the migration SQL.

## Out of scope (do NOT touch)
- **Payments / payouts** — per the project root CLAUDE.md, this is explicitly out. The 1099 task above is in scope (tax forms tie into eventual 1099 generation).
- **The existing `tiktokApiKey` / `instagramToken` columns on `team_settings`** — they're dead but kept around for safe rollouts. Don't remove yet.

## Out-of-the-blue ideas that are NOT tasks
If you spot something obviously broken or missing while doing one of the above tasks, fix it only if it's tiny (typo, broken import). Otherwise log it in CHANGELOG under "Drive-by observations" so Cami can prioritize separately. Don't go on tangents.
