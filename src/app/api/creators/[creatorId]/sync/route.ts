import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";
import {
  assessApifyBudget,
  fetchWithMemoryRetry,
  handleKey,
  mapWithConcurrency,
  recordHandleScrapeSuccess,
  resolveSyncHandles,
  loadExistingMetrics,
  loadHandleSyncStates,
  upsertPost,
  SCRAPE_CONCURRENCY,
  type SyncPlatform,
} from "@/lib/social/sync";
import {
  planScrape,
  trackingCutoff,
  HANDLE_FRESH_WINDOW_MANUAL_MS,
} from "@/lib/social/scrape-plan";
import {
  SCRAPE_RESULTS_LIMIT,
  SHALLOW_SCRAPE_RESULTS_LIMIT,
} from "@/lib/social/apify";
import type { SocialPost } from "@/lib/social/types";

/**
 * Manual per-creator sync. Scrapes TikTok + Instagram + YouTube Shorts via
 * Apify for every active handle the creator has (primary columns plus extra
 * CreatorAccount rows) and upserts into Post + PostMetricsSnapshot through the
 * same guarded write path as the campaign sync — so a partial scrape can't
 * overwrite real view counts here either.
 *
 * Keeps every post it can scrape (no campaign date-window filtering, no
 * deletion of posts missing from the scrape — per Jacqueline, 2026-07-15).
 * Attaches posts to the creator's most recent active campaign if any,
 * otherwise only creates a fresh PostMetricsSnapshot against existing posts.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { creatorId } = await params;

  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: {
      accounts: true,
      // Prefer an active membership, but fall back to a deactivated one — a
      // deactivated creator's posts still attach to the campaign they were
      // deactivated from so viral videos keep being tracked.
      campaignCreators: {
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          useDefaultHandles: true,
          campaign: {
            select: { id: true, startDate: true },
          },
        },
      },
    },
  });

  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  // Scope check: super admin sees all; client manager sees creators on their
  // team's campaigns OR creators "homed" on their team.
  const allowed = await canAccessCreator(prisma, creator, session);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const membership = creator.campaignCreators[0];
  const campaignId = membership?.campaign?.id;
  // Profile default handles follow the membership's "use default handles"
  // setting, same as the campaign sync (per Jacqueline, 2026-07-15 — most
  // creators are tracked purely via per-campaign accounts). Only a creator
  // with no campaign membership at all falls back to their profile handles.
  const includeDefaults = membership ? membership.useDefaultHandles : true;

  // The historical TikTok fallback to the generic `handle` is preserved here
  // (the campaign-wide sync only falls back to tiktokUsername).
  const handleTasks = resolveSyncHandles(
    {
      handle: creator.handle,
      tiktokHandle:
        creator.tiktokHandle || creator.tiktokUsername || creator.handle,
      tiktokUsername: creator.tiktokUsername,
      instagramHandle: creator.instagramHandle,
      youtubeHandle: creator.youtubeHandle,
      accounts: creator.accounts,
    },
    campaignId ?? null,
    includeDefaults
  );

  // This button had no rate limit at all — mashing it deep-scraped every
  // handle (IG = two actors) on every click. Same planner as the campaign
  // sync: a 30-min freshness window absorbs repeat clicks, and the account's
  // budget mode still applies (critical forces shallow scrapes).
  const [states, budget] = await Promise.all([
    loadHandleSyncStates(handleTasks),
    assessApifyBudget(),
  ]);
  const planNow = Date.now();
  const staleTasks = handleTasks.flatMap((t) => {
    const decision = planScrape({
      state: states.get(handleKey(t.platform, t.handle)),
      tier: "active",
      budgetMode: budget?.mode ?? null,
      callerFreshWindowMs: HANDLE_FRESH_WINDOW_MANUAL_MS,
      now: planNow,
    });
    return decision.action === "run" ? [{ ...t, depth: decision.depth }] : [];
  });
  const freshSkipped = handleTasks.length - staleTasks.length;

  const failures: { platform: SyncPlatform; handle: string; error: string }[] =
    [];
  const fetchResults = await mapWithConcurrency(
    staleTasks,
    SCRAPE_CONCURRENCY,
    async (t) => ({
      ...t,
      posts: await fetchWithMemoryRetry(
        t.platform,
        t.handle,
        t.depth === "shallow"
          ? SHALLOW_SCRAPE_RESULTS_LIMIT
          : SCRAPE_RESULTS_LIMIT,
        t.depth
      ).catch((e) => {
        console.error(`${t.platform.toLowerCase()} scrape failed`, e);
        failures.push({
          platform: t.platform,
          handle: t.handle,
          error: e instanceof Error ? e.message : String(e),
        });
        return [] as SocialPost[];
      }),
    })
  );

  const allPosts = fetchResults.flatMap((r) => r.posts);
  let upserted = 0;

  const failedKeys = new Set(
    failures.map((f) => handleKey(f.platform, f.handle))
  );
  for (const r of fetchResults) {
    if (!failedKeys.has(handleKey(r.platform, r.handle))) {
      await recordHandleScrapeSuccess(r.platform, r.handle, r.depth);
    }
  }

  if (campaignId) {
    // Same pre-campaign tracking window as the campaign sync: a handle's
    // ancient history isn't campaign performance and never enters the DB.
    const cutoff = trackingCutoff(membership!.campaign.startDate);
    const existingByKey = await loadExistingMetrics(allPosts);
    for (const r of fetchResults) {
      for (const post of r.posts) {
        if (post.postedAt < cutoff) continue;
        // Posts from a campaign-scoped account belong to this campaign even
        // if another campaign's sync created the row first.
        await upsertPost(
          post,
          campaignId,
          creatorId,
          r.scopedToCampaign,
          existingByKey.get(`${post.platform}:${post.externalId}`)
        );
        upserted++;
      }
    }
  }

  const countByPlatform = (p: SyncPlatform) =>
    fetchResults
      .filter((r) => r.platform === p)
      .reduce((n, r) => n + r.posts.length, 0);

  return NextResponse.json({
    ok: true,
    fetched: allPosts.length,
    upserted,
    tiktokPosts: countByPlatform("TIKTOK"),
    instagramPosts: countByPlatform("INSTAGRAM"),
    youtubePosts: countByPlatform("YOUTUBE"),
    youtubeAttempted: handleTasks.some((t) => t.platform === "YOUTUBE"),
    failures,
    accountsAttempted: staleTasks.length,
    freshSkipped,
    attachedToCampaign: campaignId ?? null,
    warning:
      !campaignId && allPosts.length > 0
        ? "Fetched posts but creator has no active campaign — nothing was written. Assign this creator to a campaign first."
        : null,
  });
}
