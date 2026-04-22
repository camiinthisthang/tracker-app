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

# Autonomous Session 2 — Task Queue

Tasks 1–9 from session 1 are complete (see CHANGELOG). This is a fresh queue. Work top-to-bottom. After each chunk: `npm run build` → push → append a CHANGELOG row. If genuinely blocked on a Cami-only decision, log it under "Blocked — needs Cami" and move on.

**Task 1 is a prerequisite — do it first.** Everything else assumes a clean database.

## Tasks

### 1. Nuclear data reset — keep only Cami + Jacqueline as super admins
Production db is polluted with test data: stale creators (e.g. `creator@viewtrackr.com` that can't be deleted), applications, users, and client teams (Merit, Chipped, etc.). Wipe everything except the two super admins.

- **Keep exactly these rows, nothing else:**
  - `User` for `camirgarzon@gmail.com` — `isSuperAdmin=true`
  - `User` for `jacquelinegiale@gmail.com` — `isSuperAdmin=true`. If a `User` row with that email doesn't exist yet, create it (leave `password` null so she goes through the /register or invite flow to set it). If a stale `Creator` / `CreatorApplication` / `TeamMember` row exists for that email, delete those first to unblock her signup.
  - One `Team` row called `Tapmore` (the agency home team — create or rename as needed)
  - Two `TeamMember` rows linking Cami and Jacqueline to the Tapmore team, both `role=ADMIN`
  - One `TeamSettings` row for Tapmore (preserve any `schedulingUrl`, `creatorWelcomeTemplate`, PostHog config if already set)
- **Delete all rows from every other table:** `Creator`, `CreatorApplication`, `Post`, `PostMetricsSnapshot`, `CampaignDailyMetric`, `Task`, `CreatorMessage`, `Upload`, `Campaign`, `CampaignCreator`, `Hook`, `BonusRule`, `ViralNotification`, `CreatorAttribution`, `WeeklyReportConfig`, `NotificationRule`, `TeamInvite`, all other `TeamMember`s, all other `Team`s, all other `User`s.
- **Implementation:** write `scripts/reset-data.ts` that takes a required `--confirm` flag. Inside a single Prisma `$transaction` so partial failure doesn't leave a half-wiped DB.
- **Run it twice:** once locally against the dev DB, once against production (via `DATABASE_URL=<prod> npx tsx scripts/reset-data.ts --confirm` — Cami will run prod herself, just leave the command in CHANGELOG for her).
- **After reset:** confirm via Prisma Studio or a quick query that `Creator.count === 0`, `User.count === 2`, and both users have `isSuperAdmin=true`.

### 2. Creator delete action
Right now there's no UI to delete a creator — you can only mark `isActive=false`. Add a real destructive delete.

- On `/creators/[id]`, add a collapsed "Danger zone" section at the bottom of the page (small red-accented card).
- Inside: a red `Delete creator` button. Clicking opens a confirmation dialog ("Type the creator's name to confirm"). Only enables the confirm button on exact match.
- `DELETE /api/creators/[creatorId]` — super-admin only for now. Cascade: deleting a Creator should cascade to `Post`, `PostMetricsSnapshot` (via Post FK), `Task`, `CreatorMessage`, `CampaignCreator`, `Upload`, `ViralNotification`, `CreatorAttribution`, `TeamMember` (the `.creatorId` link).
- Check existing Prisma schema: most FKs should already have `onDelete: Cascade`. If any don't, add them in a migration.
- After success: toast "Creator deleted" and redirect to `/creators`.

### 3. BonusRule trigger dropdown — expose USER_DOWNLOAD + USER_PAID_PLAN
The `BonusTrigger` enum in `prisma/schema.prisma` already has `USER_DOWNLOAD` and `USER_PAID_PLAN`. The UI dropdown just doesn't surface them.

- Find the bonus-rule form (likely on `/clients/[teamId]` or a dedicated bonus rules section). Search for `BonusTrigger` / `VIEW_THRESHOLD` usage.
- Add two options to the trigger dropdown:
  - `USER_DOWNLOAD` → label: "Bonus per user signup (PostHog)"
  - `USER_PAID_PLAN` → label: "Bonus per user on paid plan (PostHog)"
- When these two triggers are selected, the "threshold" field should be repurposed to mean "count of signups" / "count of paid users". Update the form's help text accordingly.
- Wire them to the existing PostHog attribution path: `CreatorAttribution` already tracks `signupCount`. Compute bonus earnings by summing `signupCount` (or the paid-plan equivalent) across the current period and multiplying by `amountUsd`.
- Update the creator-facing Bonus tracker card on `/home` to reflect the new rule types (progress toward signup/paid-plan milestones).

### 4. Differentiate agency manager vs. client manager
Current setup only has `User.isSuperAdmin`. No way to distinguish "manager on Cami's Tapmore team" from "manager on a client team" — they're both just `isSuperAdmin=false, role=ADMIN`.

- Define semantic rules (no new schema needed — derive from existing data):
  - **Agency manager** = member of the `Tapmore` team (regardless of `isSuperAdmin`). Sees all clients, all creators, all campaigns.
  - **Client manager** = member of a non-Tapmore team. Sees only their own team's stuff.
  - Cami specifically = super admin on Tapmore (isSuperAdmin=true).
- Helper function `getUserAccessLevel(session)` returning `"super_admin" | "agency_manager" | "client_manager" | "creator"`. Put in `src/lib/auth.ts`.
- Update `/clients/[teamId]` members list to show the role explicitly (badge: "Agency manager" vs "Client manager").
- `/clients` page should probably only be visible to agency managers + super admins.
- Audit existing visibility functions (`creatorVisibilityWhere`, `canAccessCreator`) to use the new helper. Agency managers should see everything; client managers only their team. Add a migration note if anything changes meaningfully.

### 5. Client manager onboarding — PostHog setup step
When a client manager accepts a team invite (`/invite/team/[token]`), after they set their password, walk them through a PostHog setup screen before they hit `/dashboard`.

- **New page:** `/onboarding/posthog` — shown after team-invite signup if the team's `TeamSettings.posthogApiKey` is null/empty.
- **Fields:**
  - PostHog API key (required, password-style input)
  - PostHog project ID (required)
  - PostHog host (optional, defaults to `https://us.i.posthog.com`, placeholder shows default)
- **Test connection button:** calls an existing or new endpoint that hits PostHog's `/api/projects/<id>/` with the key. Returns success/failure inline.
- **Skip for now:** links straight to `/dashboard`. Don't block. Store a `TeamSettings.posthogOnboardingSkippedAt` timestamp so we can remind them later.
- After save: redirect to `/dashboard` with a toast "PostHog connected ✓".
- **Routing hook:** update the team-invite accept flow (`src/app/api/invite/team/accept/route.ts` or the signup component) to redirect to `/onboarding/posthog` instead of `/dashboard` when the team has no PostHog creds yet.
- **Don't force the step on existing users.** Only runs immediately after a fresh team-invite signup.

### 6. Better error messages for the "email already in use" case
When Cami tried to invite `jacquelinegiale@gmail.com`, she got a generic "email already in use" error. After task 1's data reset this specific case goes away, but the error remains bad for future dupes.

- Find wherever this error is thrown (POST `/api/creators`, application accept flow, team invite accept, or creator signup).
- Make the error specify **which table** has the conflict: "A Creator already exists with this email" vs "A User account already exists with this email" vs "An open application exists with this email".
- Include a next-action suggestion: "Delete the existing creator first" or "Use the invite flow instead of creating a new one".
- Return the existing row's ID in the error response so the UI can link directly to it.


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
