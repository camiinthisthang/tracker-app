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
  // Cut creators (cc.isActive=false) STILL sync — cut means "hidden from the
  // campaign's pacing/progress pages", not "stop tracking": if a cut
  // creator's post goes viral we still want the views. What stops a
  // creator's sync entirely is deactivating them (Creator.isActive=false) or
  // deactivating individual handles.
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: {
        where: { creator: { isActive: true } },
        include: { creator: { include: { accounts: true } } },
      },
    },
  });

  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // No date-window filtering: we keep EVERY post we can scrape from a
  // creator's accounts (per Jacqueline, 2026-07-15 — clients want the full
  // account picture; a viral video from before the campaign window still
  // counts). Goal/pacing math applies its own contract windows at read time.
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
    // A cut member with no handles isn't a problem worth flagging — only
    // active members are expected to be trackable.
    if (handles.length === 0 && cc.isActive) {
      skipped.push({
        creator: cc.creator.handle,
        reason: "no TikTok, Instagram, or YouTube handle on profile",
      });
    }
  }

  const fetches = tasks.map(async (task) => {
    try {
      const fetched = await fetchForPlatform(task.platform, task.handle);
      return {
        task,
        posts: HASHTAG_FILTERING_ENABLED
          ? filterByHashtags(fetched, campaign.hashtags)
          : fetched,
        success: true,
      };
    } catch (error) {
      console.error(
        `Sync error for creator ${task.cc.creator.handle} on ${task.platform}:`,
        error
      );
      skipped.push({
        creator: task.cc.creator.handle,
        reason: `${task.platform} @${task.handle}: ${
          error instanceof Error ? error.message : "fetch failed"
        }`,
      });
      return {
        task,
        posts: [] as SocialPost[],
        success: false,
      };
    }
  });

  const fetchResults = await Promise.all(fetches);

  const existingByKey = await loadExistingMetrics(
    fetchResults.flatMap((r) => r.posts)
  );

  // DB writes are sequential to avoid overwhelming the connection pool.
  for (const { task, posts } of fetchResults) {
    for (const post of posts) {
      await upsertPost(
        post,
        campaignId,
        task.cc.creatorId,
        task.scopedToCampaign,
        existingByKey.get(`${post.platform}:${post.externalId}`)
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
  // This is the ONLY deletion left in sync. Posts missing from a scrape are
  // never auto-deleted (per Jacqueline, 2026-07-15): the actors routinely
  // return partial sets, and trusting one run made post counts bounce. A
  // video the creator really deleted keeps its last-known metrics.
  let totalPrunedStale = 0;
  const prunedPairs = new Set<string>();
  for (const { task, success } of fetchResults) {
    if (!success) continue;

    const pairKey = `${task.cc.creatorId}:${task.platform}`;
    if (prunedPairs.has(pairKey)) continue;
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

  // Update campaign daily metrics
  await updateCampaignDailyMetrics(campaignId, today);

  // Update lastSyncAt + persist the outcome so failures are visible in the
  // UI (campaign overview banner) instead of only in server logs.
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      lastSyncAt: new Date(),
      lastSyncSummary: {
        at: new Date().toISOString(),
        postsUpserted: totalPostsUpserted,
        platformAttempts: tasks.length,
        failures: skipped,
      },
    },
  });

  return {
    postsUpserted: totalPostsUpserted,
    prunedStale: totalPrunedStale,
    creatorsAttempted: campaign.campaignCreators.length,
    platformAttempts: tasks.length,
    skipped,
  };
}

/**
 * Stored view counts + suspect-drop counters for a batch of scraped posts, in
 * one query — lets upsertPost spot a bogus metric downgrade (a scrape that
 * says 32 for a post we know has 30k) without a per-post read.
 */
export async function loadExistingMetrics(
  posts: SocialPost[]
): Promise<Map<string, { views: number; suspectDropCount: number }>> {
  const byKey = new Map<string, { views: number; suspectDropCount: number }>();
  if (posts.length === 0) return byKey;
  const existing = await prisma.post.findMany({
    where: {
      OR: posts.map((p) => ({
        platform: p.platform,
        externalId: p.externalId,
      })),
    },
    select: {
      platform: true,
      externalId: true,
      views: true,
      suspectDropCount: true,
    },
  });
  for (const p of existing) {
    byKey.set(`${p.platform}:${p.externalId}`, {
      views: p.views,
      suspectDropCount: p.suspectDropCount,
    });
  }
  return byKey;
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
 * created the row first. Shared by the campaign sync and the manual
 * per-creator sync so the suspicious-metric-drop guard applies to both.
 */
export async function upsertPost(
  post: SocialPost,
  campaignId: string,
  creatorId: string,
  reassignCampaign = false,
  known?: { views: number; suspectDropCount: number }
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Scrapers sometimes return garbage metrics for a post we already track:
  // zeroed-out rows (still processing, partial actor output) or a massive
  // undercount (the "30k post showing 32 views" bug). Skip the metric
  // overwrite in both cases — the stored numbers survive and the next
  // healthy sync updates them. Creates still record whatever the scrape
  // said (a brand-new post genuinely starts near zero).
  //
  // Escape hatch: if 3 consecutive syncs report the same "suspicious" low
  // reading, it's the stored number that's wrong (e.g. one inflated scrape)
  // — accept the low value so a bad high can't lock in forever.
  const zeroed = post.views === 0 && known != null && known.views > 0;
  const bigDrop =
    known != null && known.views >= 1000 && post.views < known.views / 2;
  const priorDrops = known?.suspectDropCount ?? 0;
  const suspicious = (zeroed || bigDrop) && priorDrops < 2;
  if (zeroed || bigDrop) {
    console.warn(
      `[sync] suspicious metric drop for ${post.platform} ${post.externalId} ` +
        `@${post.username}: scraped views=${post.views}, stored=${known?.views} ` +
        `(consecutive=${priorDrops + 1}${suspicious ? ", keeping stored" : ", accepting scraped"})`
    );
  }
  const metricsUpdate = suspicious
    ? { suspectDropCount: priorDrops + 1 }
    : {
        views: post.views,
        likes: post.likes,
        shares: post.shares,
        saves: post.saves,
        comments: post.comments,
        suspectDropCount: 0,
      };

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
      ...metricsUpdate,
      title: post.title,
      thumbnailUrl: post.thumbnailUrl,
      musicTitle: post.musicTitle ?? null,
      musicAuthor: post.musicAuthor ?? null,
      musicOriginal: post.musicOriginal ?? null,
      ...(reassignCampaign ? { campaignId } : {}),
    },
  });

  // Daily snapshot mirrors the post's stored (post-guard) numbers, so a
  // zeroed scrape doesn't write a bogus dip into the metrics history either.
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
      views: dbPost.views,
      likes: dbPost.likes,
      shares: dbPost.shares,
      saves: dbPost.saves,
      comments: dbPost.comments,
    },
    update: {
      views: dbPost.views,
      likes: dbPost.likes,
      shares: dbPost.shares,
      saves: dbPost.saves,
      comments: dbPost.comments,
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
