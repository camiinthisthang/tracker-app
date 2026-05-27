import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";
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
    droppedOutOfRange,
    prunedOutOfRange,
    tiktokPosts: tiktokPosts.length,
    instagramPosts: instagramPosts.length,
    attachedToCampaign: campaignId ?? null,
    warning:
      !campaignId && allPosts.length > 0
        ? "Fetched posts but creator has no active campaign — nothing was written. Assign this creator to a campaign first."
        : null,
  });
}
