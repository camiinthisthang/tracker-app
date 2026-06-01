import { notFound } from "next/navigation";
import Link from "next/link";
import { format, startOfWeek, addDays, subDays, startOfDay } from "date-fns";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { SyncButton } from "@/components/campaigns/sync-button";
import { Badge } from "@/components/ui/badge";
import { TopPostsGallery } from "@/components/campaigns/top-posts-gallery";
import {
  CreatorProgressSection,
  type CreatorProgress,
} from "@/components/campaigns/creator-progress";
import { CampaignViewsChart } from "@/components/campaigns/campaign-views-chart";
import {
  CampaignCreatorsTable,
  type CampaignCreatorRow,
} from "@/components/campaigns/campaign-creators-table";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const VIRAL_THRESHOLD = 50_000;

export default async function CampaignOverviewPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...campaignVisibilityWhere(session) },
    include: {
      campaignCreators: {
        include: { creator: true },
      },
      _count: { select: { posts: true, tasks: true } },
    },
  });

  if (!campaign) notFound();

  // Aggregate post metrics
  const metrics = await prisma.post.aggregate({
    where: { campaignId },
    _sum: {
      views: true,
      likes: true,
      comments: true,
      shares: true,
      saves: true,
      referrals: true,
    },
  });

  const totalViews = metrics._sum.views ?? 0;
  const totalLikes = metrics._sum.likes ?? 0;
  const totalComments = metrics._sum.comments ?? 0;
  const totalReferrals = metrics._sum.referrals ?? 0;

  const engagementRate =
    totalViews > 0
      ? (((totalLikes + totalComments) / totalViews) * 100).toFixed(2)
      : "0.00";

  // All campaign posts — for creator aggregation, top posts, and chart
  const allPosts = await prisma.post.findMany({
    where: { campaignId },
    include: { creator: { select: { handle: true } } },
    orderBy: { postedAt: "desc" },
  });

  const topPosts = [...allPosts]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Aggregate daily views for chart (last 28 days)
  const chartStart = startOfDay(subDays(new Date(), 28));
  const dailyMetrics = await prisma.campaignDailyMetric.findMany({
    where: {
      campaignId,
      date: { gte: chartStart },
    },
    orderBy: { date: "asc" },
  });

  const chartData = dailyMetrics.map((m) => ({
    date: m.date.toISOString(),
    views: m.totalViews,
  }));

  // Creator weekly progress (Mon–Sun of current week)
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);

  const weekPosts = allPosts.filter(
    (p) => p.postedAt >= weekStart && p.postedAt < weekEnd
  );

  // Per-creator monthlyPostGoal overrides the campaign-level weeklyPostTarget
  // when set. Per-day ring target = weekly / DAY_LABELS.length.
  const creatorProgresses: CreatorProgress[] = campaign.campaignCreators.map(
    (cc) => {
      const weeklyTarget =
        cc.monthlyPostGoal != null
          ? cc.monthlyPostGoal / 4
          : campaign.weeklyPostTarget;
      const dailyTarget = weeklyTarget / DAY_LABELS.length;

      const creatorPosts = weekPosts.filter(
        (p) => p.creatorId === cc.creatorId
      );

      const postsPerDay = DAY_LABELS.map((label, i) => {
        const dayStart = addDays(weekStart, i);
        const dayEnd = addDays(dayStart, 1);
        const count = creatorPosts.filter(
          (p) => p.postedAt >= dayStart && p.postedAt < dayEnd
        ).length;
        return { day: label, count };
      });

      return {
        creatorId: cc.creatorId,
        creatorName: cc.creator.name,
        creatorHandle: cc.creator.handle,
        videosPerDay: dailyTarget,
        weeklyTarget,
        postsThisWeek: creatorPosts.length,
        postsPerDay,
      };
    }
  );

  // Creators table aggregation
  const creatorRows: CampaignCreatorRow[] = campaign.campaignCreators
    .map((cc) => {
      const creatorPosts = allPosts.filter((p) => p.creatorId === cc.creatorId);
      const postCount = creatorPosts.length;
      const totalCreatorViews = creatorPosts.reduce(
        (s, p) => s + p.views,
        0
      );
      const totalCreatorLikes = creatorPosts.reduce(
        (s, p) => s + p.likes,
        0
      );
      const totalCreatorReferrals = creatorPosts.reduce(
        (s, p) => s + p.referrals,
        0
      );
      const viralCount = creatorPosts.filter(
        (p) => p.views >= VIRAL_THRESHOLD
      ).length;

      return {
        creatorId: cc.creatorId,
        creatorName: cc.creator.name,
        creatorHandle: cc.creator.handle,
        tier: cc.creator.tier,
        videosPerDay: cc.videosPerDay,
        postCount,
        totalViews: totalCreatorViews,
        avgViews: postCount > 0 ? Math.round(totalCreatorViews / postCount) : 0,
        totalLikes: totalCreatorLikes,
        viralCount,
        totalReferrals: totalCreatorReferrals,
      };
    })
    .sort((a, b) => b.totalReferrals - a.totalReferrals);

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={`${campaign.campaignCreators.length} creators · ${format(campaign.startDate, "MMM d, yyyy")} - ${format(campaign.endDate, "MMM d, yyyy")}`}
      >
        <Link href={`/campaigns/${campaign.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
        <SyncButton
          campaignId={campaign.id}
          campaignName={campaign.name}
          lastSyncAt={campaign.lastSyncAt?.toISOString()}
        />
      </PageHeader>

      {/* Campaign Details — full width at the top */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">
          Campaign Details
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs text-slate-400">Status</p>
            <div className="mt-1">
              <Badge
                className={
                  campaign.isActive
                    ? "bg-green-50 text-green-600 hover:bg-green-50"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-100"
                }
              >
                {campaign.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400">Weekly target</p>
            <p className="mt-1 text-sm text-slate-700">
              {campaign.weeklyPostTarget} posts
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">UGC Engineer</p>
            <p className="mt-1 text-sm text-slate-700">
              {campaign.ugcEngineer || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Hashtags</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {campaign.hashtags.length === 0 ? (
                <span className="text-sm text-slate-400">—</span>
              ) : (
                campaign.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400">Last sync</p>
            <p className="mt-1 text-sm text-slate-700">
              {campaign.lastSyncAt
                ? format(campaign.lastSyncAt, "MMM d, h:mm a")
                : "Never"}
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Posts"
          value={campaign._count.posts.toLocaleString()}
        />
        <StatCard label="Total Views" value={totalViews.toLocaleString()} />
        <StatCard
          label="Total Referrals"
          value={totalReferrals.toLocaleString()}
        />
        <StatCard label="Engagement Rate" value={`${engagementRate}%`} />
      </div>

      {/* Daily Views Over Time */}
      <div className="mt-6">
        <CampaignViewsChart data={chartData} />
      </div>

      {/* Creator Progress (preview — 3 cards + See all) */}
      <div className="mt-6">
        <CreatorProgressSection
          progresses={creatorProgresses}
          campaignId={campaign.id}
        />
      </div>

      {/* Top Posts Gallery */}
      <div className="mt-6">
        <TopPostsGallery posts={topPosts} />
      </div>

      {/* Creators — full width table with Viral column */}
      <div className="mt-6">
        <CampaignCreatorsTable creators={creatorRows} />
      </div>
    </div>
  );
}
