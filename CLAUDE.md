@AGENTS.md

# Autonomous Overnight Session — Task Queue

These tasks are queued for unattended execution while Cami sleeps. Work through them top-to-bottom. After each meaningful chunk: run `npm run build`, push, append a row to `CHANGELOG.md`. If something is genuinely blocked on a decision only Cami can make, log it under "Blocked — needs Cami" in CHANGELOG and move on to the next task.

## Tasks

### 1. Verify Apify integration end-to-end
We wired `clockworks/tiktok-scraper` and `apify/instagram-scraper` last session but never proved they actually return useful data. Run a smoke test:

- Pick one well-known public TikTok handle (e.g. `nike`) and one public Instagram handle (`nike` again). Use `resultsPerPage` / `resultsLimit` of **3** to keep credit burn near zero.
- Call `fetchTikTokPostsViaApify("nike", 3)` and `fetchInstagramPostsViaApify("nike", 3)` directly from a tiny script (e.g. `tsx scripts/test-apify.ts`).
- Inspect the parsed `SocialPost[]`. Confirm fields populate: `views`, `likes`, `comments`, `postedAt`, `link`, `thumbnailUrl`, `title`.
- If field mappings are off (Apify changed actor output schema), fix `src/lib/social/apify.ts` and re-test.
- Document in CHANGELOG: actor versions used, fields that worked, fields that needed remapping, total credit cost.

### 2. Auto-create tax-form task for newly onboarded creators
When a `Creator` row is created via application approval, automatically add a Task to their `/creator-tasks` list:

- **Title:** Submit your tax form
- **Body:** "We need a completed tax form before your first payment. Pick whichever applies:
  - **W-9** (US residents / tax citizens): https://www.irs.gov/pub/irs-pdf/fw9.pdf
  - **W-8BEN** (non-US): https://www.irs.gov/pub/irs-pdf/fw8ben.pdf

Fill it out and upload the completed PDF in the Uploads tab — pick 'Onboarding documents' as the destination."

- **Type:** new task category `ONBOARDING` if the existing enum needs extending; otherwise reuse the closest existing category.
- **Due date:** 7 days from creator creation.
- Hook this into the existing application-approve flow in `src/app/api/applications/[applicationId]/route.ts` right next to the pinned welcome message creation.
- Add an "Onboarding documents" upload bucket (or generalize the upload form to accept a tax-form upload type).

### 3. Auto-create FTC + account-warming task for newly onboarded creators
Add a second auto-task with the body below, exactly as Cami wrote it. Keep markdown formatting intact.

> **Account Setup & FTC Compliance**
>
> Creators should create an 'incognito brand page' with a username format like `name_chipped`. Per FTC (Federal Trade Commission) guidelines, it's required to include clear disclosure that the account is affiliated with a company. This means adding a phrase like "[Chipped] partner" in the bio. Use a personal-style profile photo rather than a logo or brand asset to maintain authenticity.
>
> **Bio Options**
>
> These are casual, organic bios that feel personal and vibe-first:
>
> - just a girl with good nails and better networking skills
> - My nails went viral before my face did
> - Built a better business card. Made it cute.
> - I don't give out my number. I tap my nail.
> - Pretty nails. Powerful tech. No one knows.
> - They asked for my @. I gave them my nail.
>
> **Algorithm Training Workflow**
>
> **Goal:** Train TikTok's algorithm to understand the account as part of the beauty/lifestyle/social niche without immediately appearing as a brand.
>
> 1. Open TikTok and go to your For You Page (FYP).
> 2. Use the search bar to find content relevant to your niche.
> 3. Filter results by "Date Posted" and select "This Month".
> 4. Engage as your target user would. Like, comment, save, and share videos that align with your niche. Comment authentically, using phrasing your ideal audience would naturally say. For example:
>    - wait this is so smart… have you tried chipped yet?
>    - your nails are stunning, you'd love chipped! it's like a business card in your manicure
>    - ok but imagine this with chipped nails… the tap would eat
>    - you're exactly who chipped was made for tbh
>    - deadass just tapped my nail and landed a collab. chipped is wild
>    - girl if you love this, chipped would blow your mind
>    - this plus chipped is how I've been meeting everyone lately
> 5. Follow relevant creators. Prioritize creators with aesthetic or talk-to-camera content who already engage with your target audience. Keep interacting with their content to train your FYP.
> 6. Repeat this entire loop 2–3 times a day for 2–3 days. Aim to follow and engage with 50–75 creators.

The copy currently mentions "Chipped" — that's the first client. For multi-client correctness, later we'll templatize the brand name with a `{{clientName}}` token like the welcome message. For now, leave as-is and put a `// TODO: templatize brand name` note next to the copy.

### 4. Hook taxonomy + tagging
Super admin defines hooks; creators tag videos with one (predefined) or "freestyle" (free-text new format). Tracked in the existing `/hooks` tab.

- **Schema:** `Hook` model probably already exists (we have a `/hooks` page). Confirm or add: `{ id, teamId, text, category?, isActive, createdAt, updatedAt }`. Add a join `PostHook { postId, hookId, isFreestyle }` OR add `Post.hookId String?` + `Post.freestyleHook String?`.
- **Super admin UI:** `/hooks` page → list + add + edit + archive hooks. Already partially built — extend.
- **Creator UI:** in the upload form (`creator-upload-form.tsx`), add a hook dropdown with options "use a defined hook" (select from list) or "freestyle: type your own" (text input). Default to defined.
- **Hooks tab analytics:** show usage count + total views + referral count per hook so Cami can spot winners.

### 5. Per-client bonus structure + creator live view
Goal: gamify earnings so creators can see "you've earned $X this month, hit 5 viral videos to earn $200 more".

- **Schema:** add a `BonusRule` model OR a JSON field on Campaign / Team for bonus configuration: `{ trigger: 'view_threshold' | 'viral_count', threshold: number, amountUsd: number, label: string }[]`. Multiple rules per client.
- **Super admin UI:** new section on `/clients/[id]` (or `/campaigns/[id]/edit`) to add/edit/remove rules.
- **Creator UI:** on `/home`, add a "Bonus tracker" card showing:
  - "$X earned this month" (computed from current post performance vs. rules)
  - "Hit 5 viral videos this month for +$200" (next milestone)
  - Progress bar toward each unmet milestone

### 6. Reports + Charts pages — initial implementation
`/reports` and `/charts` are blank scaffolds. Build:

**Reports (weekly digest):**
- Total views this week
- Top 5 hooks by view count of tagged videos
- Top 5 creators by views and referrals
- New sign-ups attributed (placeholder for now if PostHog isn't wired yet)
- Generate every Monday at 9 AM team-local-time via cron at `/api/cron/weekly-report`. Send via Resend to recipients listed in `WeeklyReportConfig` (already exists in schema).
- The report itself should also be viewable in-app at `/reports/[slug]` (route already exists for public weekly report).

**Charts:**
- Line chart: views over the last 30 days
- Bar chart: top 10 creators by views (last 30d)
- Bar chart: top 10 hooks by views (last 30d)
- Use `recharts` (already installed). Match existing UI (no gradients, slate/blue palette).

### 7. PostHog integration for download attribution
Per-client, allow connecting PostHog so we can attribute real signups to creators via referral links.

- **Schema:** add `Team.posthogApiKey`, `Team.posthogProjectId`, `Team.posthogHost?` (defaults to `https://us.i.posthog.com`).
- **Super admin UI:** new section on `/clients/[id]` to paste API key + project ID. Test connection button.
- **Sync job:** new daily cron at `/api/cron/posthog-sync` that, for each team with PostHog configured, queries PostHog for events where `properties.referral_creator_id` matches one of our creator IDs. Upserts a `CreatorAttribution` row per (creator, day) with signup count.
- **Surface:** add "Attributed signups" stat to `/creators/[id]` and `/dashboard`.
- Build it so the only setup step is pasting the API key — everything else "just works".

### 8. Viral video notifications (opt-in email + SMS)
When a post crosses a viral threshold (default: 50K views in 24h, configurable), notify the creator so they can capitalize.

- **Schema:** add `Creator.notificationPrefs Json` with shape `{ viralEmail: bool, viralSms: bool, phoneNumber?: string, threshold?: number }`. Default `viralEmail: false, viralSms: false`.
- **Creator UI:** new card on `/profile` to opt in/out + set phone number + threshold override.
- **Detection:** daily cron compares `PostMetricsSnapshot` for today vs. yesterday; if `viewsDelta >= threshold`, fire notification.
- **Email:** via Resend (already wired). Subject: "Your video is going viral" + link to the post.
- **SMS:** via Twilio. If Twilio isn't set up, log a warning and skip SMS — don't block. Add a CHANGELOG note that Twilio creds are needed to enable SMS.
- Track sent notifications in a `ViralNotification` row (postId, creatorId, channel, sentAt) so we don't spam the same post twice.

### 9. UI audit
Walk every page, every button, every textbox, every dropdown. For each:
- If it works → leave alone.
- If it's broken / orphaned / leftover from an earlier implementation → either remove it OR add a `// TODO(cami): orphan?` comment AND list it in CHANGELOG under "UI audit findings" so Cami can decide.
- Be conservative — if you're unsure whether something is in use, leave it and flag.

Pages to cover at minimum:
- `/dashboard`, `/campaigns`, `/campaigns/[id]/*`, `/creators`, `/creators/[id]`, `/posts`, `/posts/gallery`, `/hooks`, `/charts`, `/reports`, `/notifications`, `/settings`
- `/applications`, `/clients`, `/clients/[id]`, `/clients/new`
- Creator: `/home`, `/profile`, `/creator-tasks`, `/creator-uploads`, `/creator-resources`, `/creator-notifications`, `/creator-settings`
- Public: `/apply`, `/login`, `/register`, `/invite/[token]`, `/invite/team/[token]`, `/pending-approval`

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
