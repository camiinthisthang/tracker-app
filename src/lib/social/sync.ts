import { prisma } from "@/lib/prisma";
import {
  fetchTikTokPostsViaApify,
  fetchInstagramPostsViaApify,
} from "./apify";
import type { SocialPost } from "./types";

// Hashtag filtering is intentionally OFF: we track each creator's entire
// account within the campaign window because creators don't reliably tag every
// post, and filtering silently dropped legit videos (e.g. Claire's Reels).
// The `filterByHashtags` logic is retained below so we can flip this to true
// (or drive it per-campaign / per-tab) if a future campaign wants
// hashtag-scoped pulls. campaign.hashtags stays stored as an optional label.
const HASHTAG_FILTERING_ENABLED = false;

type CreatorHandles = {
  handle: string;
  tiktokHandle: string | null;
  tiktokUsername: string | null;
  instagramHandle: string | null;
};

// Every creator is treated as multi-platform: we try TikTok and Instagram for
// each one, regardless of the CampaignCreator.platform column (kept around for
// historical reasons but no longer surfaced in the UI). A platform is only
// attempted when the creator actually has a handle for it.
function resolveTikTokHandle(c: CreatorHandles): string | null {
  return c.tiktokHandle || c.tiktokUsername || null;
}

function resolveInstagramHandle(c: CreatorHandles): string | null {
  return c.instagramHandle || null;
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
        include: { creator: true },
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
    platform: "TIKTOK" | "INSTAGRAM";
    handle: string;
  };
  const tasks: FetchTask[] = [];
  for (const cc of campaign.campaignCreators) {
    const tiktok = resolveTikTokHandle(cc.creator);
    const instagram = resolveInstagramHandle(cc.creator);
    if (tiktok) tasks.push({ cc, platform: "TIKTOK", handle: tiktok });
    if (instagram) tasks.push({ cc, platform: "INSTAGRAM", handle: instagram });
    if (!tiktok && !instagram) {
      skipped.push({
        creator: cc.creator.handle,
        reason: "no TikTok or Instagram handle on profile",
      });
    }
  }

  const fetches = tasks.map(async (task) => {
    try {
      const fetched =
        task.platform === "TIKTOK"
          ? await fetchTikTokPostsViaApify(task.handle)
          : await fetchInstagramPostsViaApify(task.handle);
      const inWindow = fetched.filter(
        (p) => p.postedAt >= windowStart && p.postedAt < windowEnd
      );
      return {
        task,
        posts: HASHTAG_FILTERING_ENABLED
          ? filterByHashtags(inWindow, campaign.hashtags)
          : inWindow,
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
      return { task, posts: [] as SocialPost[], success: false };
    }
  });

  const fetchResults = await Promise.all(fetches);

  // DB writes are sequential to avoid overwhelming the connection pool.
  for (const { task, posts } of fetchResults) {
    for (const post of posts) {
      await upsertPost(post, campaignId, task.cc.creatorId);
      totalPostsUpserted++;
    }
  }

  // Prune stale-handle posts: if a creator's TikTok handle was previously
  // pointed at someone else's account (e.g. used for testing) and then changed
  // back, the posts scraped under the old handle still sit in the DB with the
  // old `username`. Drop any rows for this (creator, platform) whose username
  // doesn't match the handle we just successfully synced. PostMetricsSnapshot
  // cascades on Post delete.
  let totalPrunedStale = 0;
  for (const { task, success } of fetchResults) {
    if (!success) continue;
    const cleanHandle = task.handle.trim().replace(/^@+/, "");
    if (!cleanHandle) continue;
    const pruned = await prisma.post.deleteMany({
      where: {
        creatorId: task.cc.creatorId,
        platform: task.platform,
        NOT: { username: { equals: cleanHandle, mode: "insensitive" } },
      },
    });
    totalPrunedStale += pruned.count;
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
 * Upsert a social post into the database and create/update today's metric snapshot.
 */
async function upsertPost(
  post: SocialPost,
  campaignId: string,
  creatorId: string
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
    },
    update: {
      views: post.views,
      likes: post.likes,
      shares: post.shares,
      saves: post.saves,
      comments: post.comments,
      title: post.title,
      thumbnailUrl: post.thumbnailUrl,
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
