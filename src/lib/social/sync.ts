import { prisma } from "@/lib/prisma";
import {
  fetchTikTokPostsViaApify,
  fetchInstagramPostsViaApify,
  fetchYouTubeShortsViaApify,
} from "./apify";
import type { SocialPost } from "./types";
import type { Platform } from "@/generated/prisma/enums";

// Hashtag filtering is intentionally OFF: we track each creator's entire
// account within the campaign window because creators don't reliably tag every
// post, and filtering silently dropped legit videos (e.g. Claire's Reels).
// The `filterByHashtags` logic is retained below so we can flip this to true
// (or drive it per-campaign / per-tab) if a future campaign wants
// hashtag-scoped pulls. campaign.hashtags stays stored as an optional label.
const HASHTAG_FILTERING_ENABLED = false;

type CreatorAccountRow = {
  platform: Platform;
  handle: string;
  isActive: boolean;
  campaignId?: string | null;
};

type CreatorHandles = {
  handle: string;
  tiktokHandle: string | null;
  tiktokUsername: string | null;
  instagramHandle: string | null;
  youtubeHandle: string | null;
  accounts?: CreatorAccountRow[];
};

export type SyncPlatform = "TIKTOK" | "INSTAGRAM" | "YOUTUBE";

function cleanHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = raw.trim().replace(/^@+/, "");
  return c.length > 0 ? c : null;
}

export type SyncHandle = {
  platform: SyncPlatform;
  handle: string;
  // True when the handle comes from an account scoped to the campaign being
  // synced — its posts belong to that campaign even if another campaign's
  // sync saw them first.
  scopedToCampaign: boolean;
};

// Every creator is treated as multi-platform: we try every platform the
// creator has at least one handle for, regardless of the
// CampaignCreator.platform column (kept around for historical reasons but no
// longer surfaced in the UI). Per platform there is the primary handle column
// plus any extra CreatorAccount rows (shadow-ban replacements, secondary
// accounts) — only active ones are scraped, and campaign-scoped accounts only
// when syncing their campaign.
export function resolveSyncHandles(
  c: CreatorHandles,
  forCampaignId?: string | null,
  // Canvas UGC: profile default handles are only synced when the campaign
  // membership opts in. Defaults to true for the manual per-creator sync
  // (no campaign context) so a profile-only creator still syncs.
  includeDefaults = true
): SyncHandle[] {
  const primary: Record<SyncPlatform, string | null> = {
    TIKTOK: cleanHandle(c.tiktokHandle) ?? cleanHandle(c.tiktokUsername),
    INSTAGRAM: cleanHandle(c.instagramHandle),
    YOUTUBE: cleanHandle(c.youtubeHandle),
  };

  const out: SyncHandle[] = [];
  const seen = new Set<string>();
  const push = (
    platform: SyncPlatform,
    handle: string | null,
    scopedToCampaign: boolean
  ) => {
    if (!handle) return;
    const key = `${platform}:${handle.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ platform, handle, scopedToCampaign });
  };

  // Campaign-scoped accounts first so they win handle dedup over an identical
  // unscoped/primary handle.
  for (const acct of c.accounts ?? []) {
    if (!acct.isActive || acct.platform === "FACEBOOK") continue;
    const scope = acct.campaignId ?? null;
    if (scope !== null && scope !== (forCampaignId ?? null)) continue;
    push(
      acct.platform as SyncPlatform,
      cleanHandle(acct.handle),
      scope !== null
    );
  }
  if (includeDefaults) {
    for (const platform of ["TIKTOK", "INSTAGRAM", "YOUTUBE"] as const) {
      push(platform, primary[platform], false);
    }
  }
  return out;
}

/**
 * Every handle we've ever known for a (creator, platform) — primary column
 * plus ALL account rows, active or not. Posts under any of these usernames are
 * legitimate history (banned accounts keep counting); anything else is a
 * stale-handle leftover and safe to prune.
 */
export function knownHandlesFor(
  c: CreatorHandles,
  platform: SyncPlatform
): string[] {
  const handles = new Set<string>();
  const add = (h: string | null) => {
    if (h) handles.add(h.toLowerCase());
  };
  if (platform === "TIKTOK") {
    add(cleanHandle(c.tiktokHandle));
    add(cleanHandle(c.tiktokUsername));
  }
  if (platform === "INSTAGRAM") add(cleanHandle(c.instagramHandle));
  if (platform === "YOUTUBE") add(cleanHandle(c.youtubeHandle));
  for (const acct of c.accounts ?? []) {
    if (acct.platform === platform) add(cleanHandle(acct.handle));
  }
  return [...handles];
}

export function fetchForPlatform(
  platform: SyncPlatform,
  handle: string
): Promise<SocialPost[]> {
  if (platform === "TIKTOK") return fetchTikTokPostsViaApify(handle);
  if (platform === "INSTAGRAM") return fetchInstagramPostsViaApify(handle);
  return fetchYouTubeShortsViaApify(handle);
}

/**
 * Sync all posts for a single campaign.
 * Fetches posts from each platform for each creator via Apify, upserts into
 * DB, creates daily metric snapshots.
 */
export async function syncCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: {
        where: { isActive: true },
        include: { creator: { include: { accounts: true } } },
      },
    },
  });

  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Date window for this campaign. End is inclusive of the full endDate day,
  // so a post at 5pm on the endDate counts. Apply at both write time (filter
  // before upsert) and as an idempotent prune (clean up legacy out-of-range
  // posts on every sync).
  const windowStart = campaign.startDate;
  const windowEnd = new Date(campaign.endDate);
  windowEnd.setDate(windowEnd.getDate() + 1);

  const prunedOutOfRange = await prisma.post.deleteMany({
    where: {
      campaignId,
      OR: [
        { postedAt: { lt: windowStart } },
        { postedAt: { gte: windowEnd } },
      ],
    },
  });

  let totalPostsUpserted = 0;
  const skipped: { creator: string; reason: string }[] = [];

  // Build (creator, platform, handle) tasks — one per platform the creator has
  // a handle for. Run all of them in parallel; each Apify run is independent
  // and the actors rate-limit internally.
  type FetchTask = {
    cc: (typeof campaign.campaignCreators)[number];
    platform: SyncPlatform;
    handle: string;
    scopedToCampaign: boolean;
  };
  const tasks: FetchTask[] = [];
  for (const cc of campaign.campaignCreators) {
    // Only fall back to the creator's profile default handles when this
    // membership opts in — otherwise track just this campaign's own accounts.
    const handles = resolveSyncHandles(
      cc.creator,
      campaignId,
      cc.useDefaultHandles
    );
    for (const h of handles) {
      tasks.push({
        cc,
        platform: h.platform,
        handle: h.handle,
        scopedToCampaign: h.scopedToCampaign,
      });
    }
    if (handles.length === 0) {
      skipped.push({
        creator: cc.creator.handle,
        reason: "no TikTok, Instagram, or YouTube handle on profile",
      });
    }
  }

  const fetches = tasks.map(async (task) => {
    try {
      const fetched = await fetchForPlatform(task.platform, task.handle);
      const inWindow = fetched.filter(
        (p) => p.postedAt >= windowStart && p.postedAt < windowEnd
      );
      return {
        task,
        posts: HASHTAG_FILTERING_ENABLED
          ? filterByHashtags(inWindow, campaign.hashtags)
          : inWindow,
        // Raw in-window externalIds (pre-hashtag-filter) — the source of truth
        // for reconciling deletions below.
        liveExternalIds: inWindow.map((p) => p.externalId),
        success: true,
      };
    } catch (error) {
      console.error(
        `Sync error for creator ${task.cc.creator.handle} on ${task.platform}:`,
        error
      );
      skipped.push({
        creator: task.cc.creator.handle,
        reason: `${task.platform} fetch failed`,
      });
      return {
        task,
        posts: [] as SocialPost[],
        liveExternalIds: [] as string[],
        success: false,
      };
    }
  });

  const fetchResults = await Promise.all(fetches);

  // DB writes are sequential to avoid overwhelming the connection pool.
  for (const { task, posts } of fetchResults) {
    for (const post of posts) {
      await upsertPost(
        post,
        campaignId,
        task.cc.creatorId,
        task.scopedToCampaign
      );
      totalPostsUpserted++;
    }
  }

  // Prune stale-handle posts: if a creator's handle was previously pointed at
  // someone else's account (e.g. used for testing) and then changed back, the
  // posts scraped under the old handle still sit in the DB with the old
  // `username`. Drop any rows for this (creator, platform) whose username
  // isn't one of the creator's known handles — primary column plus every
  // CreatorAccount row, active or not, so a deactivated (banned) account's
  // history survives. PostMetricsSnapshot cascades on Post delete.
  let totalPrunedStale = 0;
  const prunedPairs = new Set<string>();
  for (const { task, success, liveExternalIds } of fetchResults) {
    if (!success) continue;

    const pairKey = `${task.cc.creatorId}:${task.platform}`;
    if (!prunedPairs.has(pairKey)) {
      prunedPairs.add(pairKey);
      const known = knownHandlesFor(task.cc.creator, task.platform);
      if (known.length > 0) {
        const pruned = await prisma.post.deleteMany({
          where: {
            creatorId: task.cc.creatorId,
            platform: task.platform,
            NOT: { username: { in: known, mode: "insensitive" } },
          },
        });
        totalPrunedStale += pruned.count;
      }
    }

    // Reconcile deletions: drop in-window posts on this exact account whose
    // externalId no longer appears in the latest scrape (deleted from the
    // platform). Scoped to this task's username so one account's scrape can't
    // delete a sibling account's posts, guarded by a non-empty live set so a
    // soft-empty scrape can't wipe real posts, and window-scoped so the
    // 60-post scrape cap can't delete older out-of-window posts. Inactive
    // accounts are never scraped, so their history is never reconciled away.
    const handle = task.handle.trim().replace(/^@+/, "");
    if (handle && liveExternalIds.length > 0) {
      const deleted = await prisma.post.deleteMany({
        where: {
          creatorId: task.cc.creatorId,
          platform: task.platform,
          username: { equals: handle, mode: "insensitive" },
          postedAt: { gte: windowStart, lt: windowEnd },
          externalId: { notIn: liveExternalIds },
        },
      });
      totalPrunedStale += deleted.count;
    }
  }

  // Update campaign daily metrics
  await updateCampaignDailyMetrics(campaignId, today);

  // Update lastSyncAt
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { lastSyncAt: new Date() },
  });

  return {
    postsUpserted: totalPostsUpserted,
    prunedStale: totalPrunedStale,
    prunedOutOfRange: prunedOutOfRange.count,
    creatorsAttempted: campaign.campaignCreators.length,
    platformAttempts: tasks.length,
    skipped,
  };
}

/**
 * Filter posts to those whose title/caption contains at least one of the
 * campaign hashtags (case-insensitive substring match). Currently gated off by
 * HASHTAG_FILTERING_ENABLED — retained for a future opt-in (e.g. a campaign or
 * tab that should only pull hashtag-tagged posts).
 */
function filterByHashtags(
  posts: SocialPost[],
  hashtags: string[]
): SocialPost[] {
  if (hashtags.length === 0) return posts;
  const lowerHashtags = hashtags.map((h) => h.toLowerCase());
  return posts.filter((post) => {
    const title = (post.title || "").toLowerCase();
    return lowerHashtags.some((tag) => title.includes(tag));
  });
}

/**
 * Upsert a social post into the database and create/update today's metric
 * snapshot. `reassignCampaign` is set for posts scraped via a campaign-scoped
 * account: they belong to that campaign even if a different campaign's sync
 * created the row first.
 */
async function upsertPost(
  post: SocialPost,
  campaignId: string,
  creatorId: string,
  reassignCampaign = false
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dbPost = await prisma.post.upsert({
    where: {
      platform_externalId: {
        platform: post.platform,
        externalId: post.externalId,
      },
    },
    create: {
      campaignId,
      creatorId,
      platform: post.platform,
      username: post.username,
      title: post.title,
      externalId: post.externalId,
      link: post.link,
      thumbnailUrl: post.thumbnailUrl,
      postedAt: post.postedAt,
      views: post.views,
      likes: post.likes,
      shares: post.shares,
      saves: post.saves,
      comments: post.comments,
      musicTitle: post.musicTitle ?? null,
      musicAuthor: post.musicAuthor ?? null,
      musicOriginal: post.musicOriginal ?? null,
    },
    update: {
      views: post.views,
      likes: post.likes,
      shares: post.shares,
      saves: post.saves,
      comments: post.comments,
      title: post.title,
      thumbnailUrl: post.thumbnailUrl,
      musicTitle: post.musicTitle ?? null,
      musicAuthor: post.musicAuthor ?? null,
      musicOriginal: post.musicOriginal ?? null,
      ...(reassignCampaign ? { campaignId } : {}),
    },
  });

  // Create daily snapshot
  await prisma.postMetricsSnapshot.upsert({
    where: {
      postId_date: {
        postId: dbPost.id,
        date: today,
      },
    },
    create: {
      postId: dbPost.id,
      date: today,
      views: post.views,
      likes: post.likes,
      shares: post.shares,
      saves: post.saves,
      comments: post.comments,
    },
    update: {
      views: post.views,
      likes: post.likes,
      shares: post.shares,
      saves: post.saves,
      comments: post.comments,
    },
  });

  return dbPost;
}

/**
 * Compute and upsert the campaign-level aggregate for a single calendar day.
 * Scoped to posts *published* that day (postedAt within [date, date+1)), so a
 * row is true daily activity — not a cumulative campaign-to-date snapshot.
 * `date` is local midnight of the day being recorded.
 */
async function updateCampaignDailyMetrics(campaignId: string, date: Date) {
  const dayEnd = new Date(date);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const metrics = await prisma.post.aggregate({
    where: { campaignId, postedAt: { gte: date, lt: dayEnd } },
    _sum: {
      views: true,
      likes: true,
      shares: true,
      saves: true,
      comments: true,
    },
    _count: true,
  });

  const activeCreators = await prisma.campaignCreator.count({
    where: { campaignId, isActive: true },
  });

  await prisma.campaignDailyMetric.upsert({
    where: {
      campaignId_date: {
        campaignId,
        date,
      },
    },
    create: {
      campaignId,
      date,
      totalPosts: metrics._count,
      totalViews: metrics._sum.views ?? 0,
      totalLikes: metrics._sum.likes ?? 0,
      totalShares: metrics._sum.shares ?? 0,
      totalSaves: metrics._sum.saves ?? 0,
      totalComments: metrics._sum.comments ?? 0,
      activeCreators,
    },
    update: {
      totalPosts: metrics._count,
      totalViews: metrics._sum.views ?? 0,
      totalLikes: metrics._sum.likes ?? 0,
      totalShares: metrics._sum.shares ?? 0,
      totalSaves: metrics._sum.saves ?? 0,
      totalComments: metrics._sum.comments ?? 0,
      activeCreators,
    },
  });
}

/**
 * Sync all active campaigns for a team, or all teams if no teamId specified.
 * Used by the cron job.
 */
export async function syncAllCampaigns(teamId?: string) {
  const where = teamId
    ? { isActive: true, teamId }
    : { isActive: true };

  const campaigns = await prisma.campaign.findMany({
    where,
    select: { id: true, name: true },
  });

  const results = [];

  for (const campaign of campaigns) {
    try {
      console.log(`Syncing campaign: ${campaign.name} (${campaign.id})`);
      const result = await syncCampaign(campaign.id);
      results.push({ campaignId: campaign.id, ...result });
    } catch (error) {
      console.error(`Failed to sync campaign ${campaign.id}:`, error);
      results.push({
        campaignId: campaign.id,
        error: String(error),
      });
    }
  }

  return results;
}
