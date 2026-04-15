import { prisma } from "@/lib/prisma";
import {
  fetchTikTokPostsViaApify,
  fetchInstagramPostsViaApify,
} from "./apify";
import type { SocialPost } from "./types";

function resolveHandle(
  platform: "TIKTOK" | "INSTAGRAM" | "YOUTUBE" | "FACEBOOK",
  creator: {
    handle: string;
    tiktokHandle: string | null;
    tiktokUsername: string | null;
    instagramHandle: string | null;
  }
): string | null {
  if (platform === "TIKTOK") {
    return creator.tiktokHandle || creator.tiktokUsername || creator.handle;
  }
  if (platform === "INSTAGRAM") {
    return creator.instagramHandle || creator.handle;
  }
  return null;
}

async function fetchPostsForPlatform(
  platform: "TIKTOK" | "INSTAGRAM" | "YOUTUBE" | "FACEBOOK",
  handle: string
): Promise<SocialPost[]> {
  if (platform === "TIKTOK") return fetchTikTokPostsViaApify(handle);
  if (platform === "INSTAGRAM") return fetchInstagramPostsViaApify(handle);
  // YouTube / Facebook: not yet wired to Apify, skip silently.
  return [];
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

  let totalPostsUpserted = 0;

  // Fetch all creators in parallel — each Apify run is independent and the
  // actors rate-limit internally. Keeps a 10-creator sync well under Vercel's
  // 300s Pro timeout vs. serial (~10×60s).
  const fetches = campaign.campaignCreators.map(async (cc) => {
    const handle = resolveHandle(cc.platform, cc.creator);
    if (!handle) return { cc, posts: [] as SocialPost[] };
    try {
      const posts = await fetchPostsForPlatform(cc.platform, handle);
      return { cc, posts: filterByHashtags(posts, campaign.hashtags) };
    } catch (error) {
      console.error(
        `Sync error for creator ${cc.creator.handle} on ${cc.platform}:`,
        error
      );
      return { cc, posts: [] as SocialPost[] };
    }
  });

  const fetchResults = await Promise.all(fetches);

  // DB writes are sequential to avoid overwhelming the connection pool.
  for (const { cc, posts } of fetchResults) {
    for (const post of posts) {
      await upsertPost(post, campaignId, cc.creatorId);
      totalPostsUpserted++;
    }
  }

  // Update campaign daily metrics
  await updateCampaignDailyMetrics(campaignId, today);

  // Update lastSyncAt
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { lastSyncAt: new Date() },
  });

  return { postsUpserted: totalPostsUpserted };
}

/**
 * Fetch posts from a social platform client, optionally filtering by hashtags.
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
 * Compute and upsert today's campaign-level aggregate metrics.
 */
async function updateCampaignDailyMetrics(campaignId: string, date: Date) {
  const metrics = await prisma.post.aggregate({
    where: { campaignId },
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
