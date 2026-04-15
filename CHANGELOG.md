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

