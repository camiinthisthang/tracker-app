import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";
import {
  fetchWithMemoryRetry,
  mapWithConcurrency,
  recordHandleScrapeSuccess,
  resolveSyncHandles,
  loadExistingMetrics,
  upsertPost,
  SCRAPE_CONCURRENCY,
  type SyncPlatform,
} from "@/lib/social/sync";
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
            select: { id: true },
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

  const failures: { platform: SyncPlatform; handle: string; error: string }[] =
    [];
  const fetchResults = await mapWithConcurrency(
    handleTasks,
    SCRAPE_CONCURRENCY,
    async (t) => ({
      ...t,
      posts: await fetchWithMemoryRetry(t.platform, t.handle).catch((e) => {
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

  // This manual sync always scrapes at full depth, so a success counts as a
  // deep pass in the freshness/deep-pass schedule the campaign sync reads.
  const failedKeys = new Set(failures.map((f) => `${f.platform}:${f.handle}`));
  for (const r of fetchResults) {
    if (!failedKeys.has(`${r.platform}:${r.handle}`)) {
      await recordHandleScrapeSuccess(r.platform, r.handle, "deep");
    }
  }

  if (campaignId) {
    const existingByKey = await loadExistingMetrics(allPosts);
    for (const r of fetchResults) {
      for (const post of r.posts) {
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
    accountsAttempted: handleTasks.length,
    attachedToCampaign: campaignId ?? null,
    warning:
      !campaignId && allPosts.length > 0
        ? "Fetched posts but creator has no active campaign — nothing was written. Assign this creator to a campaign first."
        : null,
  });
}
