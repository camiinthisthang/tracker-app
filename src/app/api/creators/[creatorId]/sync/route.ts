import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  fetchTikTokPostsViaApify,
  fetchInstagramPostsViaApify,
} from "@/lib/social/apify";
import type { SocialPost } from "@/lib/social/types";

/**
 * Manual per-creator sync. Scrapes TikTok + Instagram via Apify for the
 * creator's handles and upserts into Post + PostMetricsSnapshot.
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
      campaignCreators: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { campaignId: true },
      },
    },
  });

  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  // Scope check: unless super admin, creator must belong to session's team.
  if (
    !session.user.isSuperAdmin &&
    creator.teamId !== session.user.teamId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaignId = creator.campaignCreators[0]?.campaignId;

  const tiktokHandle =
    creator.tiktokHandle || creator.tiktokUsername || creator.handle;
  const instagramHandle = creator.instagramHandle;

  const [tiktokPosts, instagramPosts] = await Promise.all([
    tiktokHandle
      ? fetchTikTokPostsViaApify(tiktokHandle).catch((e) => {
          console.error("tiktok scrape failed", e);
          return [] as SocialPost[];
        })
      : Promise.resolve([] as SocialPost[]),
    instagramHandle
      ? fetchInstagramPostsViaApify(instagramHandle).catch((e) => {
          console.error("instagram scrape failed", e);
          return [] as SocialPost[];
        })
      : Promise.resolve([] as SocialPost[]),
  ]);

  const allPosts = [...tiktokPosts, ...instagramPosts];
  let upserted = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const post of allPosts) {
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

  return NextResponse.json({
    ok: true,
    fetched: allPosts.length,
    upserted,
    tiktokPosts: tiktokPosts.length,
    instagramPosts: instagramPosts.length,
    attachedToCampaign: campaignId ?? null,
    warning:
      !campaignId && allPosts.length > 0
        ? "Fetched posts but creator has no active campaign — nothing was written. Assign this creator to a campaign first."
        : null,
  });
}
