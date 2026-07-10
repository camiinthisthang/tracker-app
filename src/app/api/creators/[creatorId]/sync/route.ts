import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";
import {
  fetchForPlatform,
  resolveSyncHandles,
  type SyncPlatform,
} from "@/lib/social/sync";
import type { SocialPost } from "@/lib/social/types";

/**
 * Manual per-creator sync. Scrapes TikTok + Instagram + YouTube Shorts via
 * Apify for every active handle the creator has (primary columns plus extra
 * CreatorAccount rows) and upserts into Post + PostMetricsSnapshot.
 *
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
      campaignCreators: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          campaign: {
            select: { id: true, startDate: true, endDate: true },
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

  const targetCampaign = creator.campaignCreators[0]?.campaign;
  const campaignId = targetCampaign?.id;

  // Campaign date window — inclusive of the full endDate day.
  const windowStart = targetCampaign?.startDate;
  const windowEnd = targetCampaign
    ? (() => {
        const d = new Date(targetCampaign.endDate);
        d.setDate(d.getDate() + 1);
        return d;
      })()
    : null;

  // Self-healing prune: drop any existing posts for this creator on the
  // target campaign whose postedAt is outside the campaign's window. Cleans
  // up legacy bad data from before the date filter was added at write time.
  let prunedOutOfRange = 0;
  if (campaignId && windowStart && windowEnd) {
    const pruned = await prisma.post.deleteMany({
      where: {
        campaignId,
        creatorId,
        OR: [
          { postedAt: { lt: windowStart } },
          { postedAt: { gte: windowEnd } },
        ],
      },
    });
    prunedOutOfRange = pruned.count;
  }

  // The historical TikTok fallback to the generic `handle` is preserved here
  // (the campaign-wide sync only falls back to tiktokUsername).
  const handleTasks = resolveSyncHandles({
    handle: creator.handle,
    tiktokHandle:
      creator.tiktokHandle || creator.tiktokUsername || creator.handle,
    tiktokUsername: creator.tiktokUsername,
    instagramHandle: creator.instagramHandle,
    youtubeHandle: creator.youtubeHandle,
    accounts: creator.accounts,
  });

  const fetchResults = await Promise.all(
    handleTasks.map(async (t) => ({
      ...t,
      posts: await fetchForPlatform(t.platform, t.handle).catch((e) => {
        console.error(`${t.platform.toLowerCase()} scrape failed`, e);
        return [] as SocialPost[];
      }),
    }))
  );

  const allPosts = fetchResults.flatMap((r) => r.posts);
  const inWindowPosts =
    windowStart && windowEnd
      ? allPosts.filter(
          (p) => p.postedAt >= windowStart && p.postedAt < windowEnd
        )
      : [];
  const droppedOutOfRange = allPosts.length - inWindowPosts.length;
  let upserted = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const post of inWindowPosts) {
    // Prefer the creator's active campaign to attach the post. If there is
    // none, skip creating — Post requires campaignId.
    if (!campaignId) continue;

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
      },
    });

    await prisma.postMetricsSnapshot.upsert({
      where: { postId_date: { postId: dbPost.id, date: today } },
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

    upserted++;
  }

  // Reconcile deletions: for each account that returned results, drop in-window
  // posts whose externalId no longer appears on the platform (deleted videos —
  // e.g. a creator who took down 8 of 12 reels). Guarded by a non-empty live
  // set so a failed or soft-empty scrape can't wipe real posts. Scoped to the
  // campaign window AND this account's username, so one account's scrape can't
  // delete a sibling account's posts (inactive/banned accounts keep history).
  let prunedDeleted = 0;
  if (campaignId && windowStart && windowEnd) {
    for (const { platform, handle, posts } of fetchResults) {
      const liveIds = posts
        .filter((p) => p.postedAt >= windowStart && p.postedAt < windowEnd)
        .map((p) => p.externalId);
      if (liveIds.length === 0) continue;
      const clean = handle.trim().replace(/^@+/, "");
      const del = await prisma.post.deleteMany({
        where: {
          campaignId,
          creatorId,
          platform,
          username: { equals: clean, mode: "insensitive" },
          postedAt: { gte: windowStart, lt: windowEnd },
          externalId: { notIn: liveIds },
        },
      });
      prunedDeleted += del.count;
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
    prunedDeleted,
    droppedOutOfRange,
    prunedOutOfRange,
    tiktokPosts: countByPlatform("TIKTOK"),
    instagramPosts: countByPlatform("INSTAGRAM"),
    youtubePosts: countByPlatform("YOUTUBE"),
    accountsAttempted: handleTasks.length,
    attachedToCampaign: campaignId ?? null,
    window:
      windowStart && windowEnd
        ? {
            start: windowStart.toISOString(),
            // windowEnd is endDate + 1 day (exclusive); report the inclusive
            // endDate the user actually set.
            end: new Date(windowEnd.getTime() - 86_400_000).toISOString(),
          }
        : null,
    droppedPosts: allPosts
      .filter((p) => !inWindowPosts.includes(p))
      .map((p) => ({
        platform: p.platform,
        postedAt: p.postedAt.toISOString(),
        title: p.title?.slice(0, 80) ?? null,
        views: p.views,
      })),
    warning:
      !campaignId && allPosts.length > 0
        ? "Fetched posts but creator has no active campaign — nothing was written. Assign this creator to a campaign first."
        : null,
  });
}
