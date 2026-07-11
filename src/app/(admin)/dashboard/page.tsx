import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import {
  campaignVisibilityWhere,
  creatorVisibilityWhere,
} from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TrendDelta } from "@/components/shared/trend-delta";
import { TopPostsWeek } from "@/components/dashboard/top-posts-week";
import { TopPostsAllTime } from "@/components/dashboard/top-posts-alltime";
import { WeeklyShoutouts } from "@/components/dashboard/weekly-shoutouts";
import { TopSounds } from "@/components/dashboard/top-sounds";
import { parseWeekOffset } from "@/lib/weeks";
import { ATTRIBUTION_ENABLED } from "@/lib/constants";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;

  const weekOffset = parseWeekOffset(params.week);
  const platformRaw = Array.isArray(params.platform)
    ? params.platform[0]
    : params.platform;
  const platform = ["TIKTOK", "INSTAGRAM", "YOUTUBE"].includes(
    platformRaw ?? ""
  )
    ? (platformRaw as string)
    : "ALL";
  const top = params.top === "10" ? 10 : 5;

  // Stat cards use rolling 7-day windows: this week = last 7 days, previous
  // week = the 7 days before that. Both sum current view counts of posts
  // *posted* in the window.
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Agency users (super admin / agency manager) see across every client team;
  // client managers stay scoped to their own team. Helpers return {} for
  // agency-wide access or { teamId } for client-scoped access.
  const campaignWhere = campaignVisibilityWhere(session);
  const creatorWhere = {
    AND: [creatorVisibilityWhere(session), { isActive: true }],
  };

  const [
    activeCampaigns,
    totalCreators,
    thisWeekAgg,
    prevWeekAgg,
    topCreatorViews,
  ] = await Promise.all([
    prisma.campaign.count({ where: { ...campaignWhere, isActive: true } }),
    prisma.creator.count({ where: creatorWhere }),
    prisma.post.aggregate({
      where: { campaign: campaignWhere, postedAt: { gte: sevenDaysAgo } },
      _sum: { views: true },
      _count: true,
    }),
    prisma.post.aggregate({
      where: {
        campaign: campaignWhere,
        postedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
      _sum: { views: true },
      _count: true,
    }),
    prisma.post.groupBy({
      by: ["creatorId"],
      where: { campaign: campaignWhere, creator: { isActive: true } },
      _sum: { views: true, likes: true, comments: true, shares: true, saves: true },
      _count: { _all: true },
      orderBy: { _sum: { views: "desc" } },
      take: 5,
    }),
  ]);

  const weeklyViews = thisWeekAgg._sum.views ?? 0;
  const prevWeeklyViews = prevWeekAgg._sum.views ?? 0;
  const weeklyPosts = thisWeekAgg._count;
  const prevWeeklyPosts = prevWeekAgg._count;

  const [attributedThisWeek, topCreatorRows] = await Promise.all([
    ATTRIBUTION_ENABLED
      ? prisma.creatorAttribution.aggregate({
          where: {
            creator: creatorVisibilityWhere(session),
            date: { gte: sevenDaysAgo },
          },
          _sum: { signupCount: true },
        })
      : Promise.resolve(null),
    prisma.creator.findMany({
      where: { id: { in: topCreatorViews.map((g) => g.creatorId) } },
      select: { id: true, name: true, handle: true },
    }),
  ]);
  const signupsThisWeek = attributedThisWeek?._sum.signupCount ?? 0;

  const creatorById = new Map(topCreatorRows.map((c) => [c.id, c]));
  const topCreators = topCreatorViews.flatMap((g) => {
    const creator = creatorById.get(g.creatorId);
    if (!creator) return [];
    const views = g._sum.views ?? 0;
    const posts = g._count._all;
    const engagements =
      (g._sum.likes ?? 0) +
      (g._sum.comments ?? 0) +
      (g._sum.shares ?? 0) +
      (g._sum.saves ?? 0);
    return [
      {
        ...creator,
        views,
        posts,
        avgViews: posts > 0 ? Math.round(views / posts) : 0,
        engagementPct: views > 0 ? (engagements / views) * 100 : 0,
      },
    ];
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name || "there"}`}
      />

      {/* Stat Cards */}
      <div
        className={`grid gap-4 sm:grid-cols-2 ${ATTRIBUTION_ENABLED ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
      >
        <StatCard label="Active Campaigns" value={activeCampaigns} />
        <StatCard label="Active Creators" value={totalCreators} />
        <StatCard
          label="Posts This Week"
          value={weeklyPosts.toLocaleString()}
          subtext={
            <TrendDelta current={weeklyPosts} previous={prevWeeklyPosts} />
          }
        />
        <StatCard
          label="Views This Week"
          value={weeklyViews.toLocaleString()}
          subtext={
            <TrendDelta current={weeklyViews} previous={prevWeeklyViews} />
          }
        />
        {ATTRIBUTION_ENABLED && (
          <StatCard
            label="Attributed Signups (7d)"
            value={signupsThisWeek.toLocaleString()}
          />
        )}
      </div>

      {/* Weekly shoutouts */}
      <div className="mt-6">
        <WeeklyShoutouts
          campaignWhere={campaignWhere}
          creatorWhere={creatorVisibilityWhere(session)}
          weekOffset={weekOffset}
        />
      </div>

      {/* Top posts — this week and all-time, side by side */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <TopPostsWeek
          campaignWhere={campaignWhere}
          weekOffset={weekOffset}
          platform={platform}
          top={top}
        />
        <TopPostsAllTime campaignWhere={campaignWhere} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Top Creators */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Top Creators
              </h3>
              <p className="text-xs text-slate-400">By total views</p>
            </div>
            <Link
              href="/creators"
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topCreators.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No creators yet</p>
          ) : (
            <div className="mt-3 space-y-2">
              {topCreators.map((creator, idx) => (
                <Link
                  key={creator.id}
                  href={`/creators/${creator.id}`}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-500">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {creator.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        @{creator.handle}
                      </p>
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 gap-4 text-right">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {creator.views.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400">total views</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {creator.avgViews.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400">avg views</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {creator.engagementPct.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-slate-400">engagement</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {creator.posts}
                      </p>
                      <p className="text-[10px] text-slate-400">posts</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top sounds (TikTok) */}
        <TopSounds campaignWhere={campaignWhere} weekOffset={weekOffset} />
      </div>

      {/* Recent Campaigns */}
      {activeCampaigns > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              Active Campaigns
            </h3>
            <Link
              href="/campaigns"
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <CampaignsList campaignWhere={campaignWhere} />
        </div>
      )}
    </div>
  );
}

async function CampaignsList({
  campaignWhere,
}: {
  campaignWhere: ReturnType<typeof campaignVisibilityWhere>;
}) {
  const campaigns = await prisma.campaign.findMany({
    where: { ...campaignWhere, isActive: true },
    include: {
      _count: { select: { posts: true, campaignCreators: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return (
    <div className="mt-3 space-y-2">
      {campaigns.map((campaign) => (
        <Link
          key={campaign.id}
          href={`/campaigns/${campaign.id}/overview`}
          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100"
        >
          <div>
            <p className="text-sm font-medium text-slate-700">
              {campaign.name}
            </p>
            <p className="text-xs text-slate-400">
              {format(campaign.startDate, "MMM d")} —{" "}
              {format(campaign.endDate, "MMM d, yyyy")} ·{" "}
              {campaign._count.campaignCreators} creators ·{" "}
              {campaign._count.posts} posts
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </Link>
      ))}
    </div>
  );
}
