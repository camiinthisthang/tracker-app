import Link from "next/link";
import { format, addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { ArrowRight, BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import {
  campaignVisibilityWhere,
  creatorVisibilityWhere,
} from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TrendDelta } from "@/components/shared/trend-delta";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { CampaignSwitcher } from "@/components/dashboard/campaign-switcher";
import { ExportPdfButton } from "@/components/dashboard/export-pdf-button";
import { DashboardViewsChart } from "@/components/dashboard/dashboard-views-chart";
import { TopPosts } from "@/components/dashboard/top-posts-week";
import { TopPostsAllTime } from "@/components/dashboard/top-posts-alltime";
import { WeeklyShoutouts } from "@/components/dashboard/weekly-shoutouts";
import { TopSounds } from "@/components/dashboard/top-sounds";
import { parseWeekOffset } from "@/lib/weeks";
import { parseDateRange, rangeParams } from "@/lib/date-range";
import { dashboardUrl, type DashboardParams } from "@/lib/dashboard-url";

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
  const range = parseDateRange(params);

  // Agency users (super admin / agency manager) see across every client team;
  // client managers stay scoped to their own team. Helpers return {} for
  // agency-wide access or { teamId } for client-scoped access.
  const visibilityWhere = campaignVisibilityWhere(session);
  const creatorWhere = {
    AND: [creatorVisibilityWhere(session), { isActive: true }],
  };

  // Campaign switcher: default = all campaigns aggregated (the client-facing
  // summary view); picking one scopes every section below to that campaign.
  const switcherCampaigns = await prisma.campaign.findMany({
    where: visibilityWhere,
    select: { id: true, name: true, isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  const campaignParam = Array.isArray(params.campaign)
    ? params.campaign[0]
    : params.campaign;
  const selectedCampaign =
    switcherCampaigns.find((c) => c.id === campaignParam) ?? null;
  const campaignWhere = selectedCampaign
    ? { ...visibilityWhere, id: selectedCampaign.id }
    : visibilityWhere;

  const rangeSpanDays = Math.max(
    1,
    differenceInCalendarDays(range.end, range.start),
  );

  const [
    activeCampaigns,
    totalCreators,
    rangeAgg,
    prevAgg,
    topCreatorViews,
    chartPosts,
  ] = await Promise.all([
    prisma.campaign.count({ where: { ...campaignWhere, isActive: true } }),
    selectedCampaign
      ? prisma.campaignCreator.count({
          where: {
            campaignId: selectedCampaign.id,
            isActive: true,
            creator: { isActive: true },
          },
        })
      : prisma.creator.count({ where: creatorWhere }),
    prisma.post.aggregate({
      where: {
        campaign: campaignWhere,
        postedAt: { gte: range.start, lt: range.end },
      },
      _sum: { views: true, likes: true, comments: true },
      _count: true,
    }),
    prisma.post.aggregate({
      where: {
        campaign: campaignWhere,
        postedAt: { gte: range.prevStart, lt: range.prevEnd },
      },
      _sum: { views: true, likes: true, comments: true },
      _count: true,
    }),
    prisma.post.groupBy({
      by: ["creatorId"],
      where: {
        campaign: campaignWhere,
        creator: { isActive: true },
        postedAt: { gte: range.start, lt: range.end },
      },
      _sum: { views: true, likes: true, comments: true, shares: true, saves: true },
      _count: { _all: true },
      orderBy: { _sum: { views: "desc" } },
      take: 5,
    }),
    rangeSpanDays >= 3
      ? prisma.post.findMany({
          where: {
            campaign: campaignWhere,
            postedAt: { gte: range.start, lt: range.end },
          },
          select: { postedAt: true, views: true },
        })
      : Promise.resolve([]),
  ]);

  const rangeViews = rangeAgg._sum.views ?? 0;
  const rangeLikes = rangeAgg._sum.likes ?? 0;
  const rangeComments = rangeAgg._sum.comments ?? 0;
  const rangePosts = rangeAgg._count;
  const prevViews = prevAgg._sum.views ?? 0;
  const prevLikes = prevAgg._sum.likes ?? 0;
  const prevComments = prevAgg._sum.comments ?? 0;
  const prevPosts = prevAgg._count;

  const topCreatorRows = await prisma.creator.findMany({
    where: { id: { in: topCreatorViews.map((g) => g.creatorId) } },
    select: { id: true, name: true, handle: true },
  });

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

  // Views over time, bucketed by day across the selected range. Hidden for
  // windows under 3 days where a daily line is meaningless.
  const chartStart = startOfDay(range.start);
  const dailyMap = new Map<string, number>();
  for (let i = 0; i <= rangeSpanDays; i++) {
    const day = startOfDay(addDays(chartStart, i));
    if (day >= range.end) break;
    dailyMap.set(day.toISOString(), 0);
  }
  for (const p of chartPosts) {
    const d = startOfDay(p.postedAt).toISOString();
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + p.views);
  }
  const chartData = Array.from(dailyMap.entries()).map(([date, views]) => ({
    date,
    views,
  }));

  // Current URL state, threaded through every dashboard link so the filters
  // survive each other.
  const dp: DashboardParams = {
    campaign: selectedCampaign?.id,
    range: range.key,
    from: range.from,
    to: range.to,
    week: weekOffset,
    platform,
    top,
  };
  const preserveForRange: Record<string, string> = {};
  if (selectedCampaign) preserveForRange.campaign = selectedCampaign.id;
  if (weekOffset > 0) preserveForRange.week = String(weekOffset);
  const preserveForCampaign: Record<string, string> = {
    ...rangeParams(range),
  };
  if (weekOffset > 0) preserveForCampaign.week = String(weekOffset);

  const chartsHref = dashboardUrl(
    {
      campaign: selectedCampaign?.id,
      range: range.key,
      from: range.from,
      to: range.to,
    },
    "/charts",
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          selectedCampaign
            ? `${selectedCampaign.name} campaign`
            : `Welcome back, ${session.user.name || "there"}`
        }
      >
        <div className="flex items-center gap-3 print:hidden">
          <CampaignSwitcher
            campaigns={switcherCampaigns}
            selectedId={selectedCampaign?.id}
            basePath="/dashboard"
            preserve={preserveForCampaign}
          />
          <Link
            href={chartsHref}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <BarChart3 className="h-4 w-4" />
            View charts
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <ExportPdfButton />
        </div>
      </PageHeader>

      {/* Date range — scopes the stat cards, views graph, top posts, top
          sounds and top creators. Weekly Shoutouts keeps its own week nav. */}
      <div className="mb-4 print:hidden">
        <DateRangeFilter
          rangeKey={range.key}
          from={range.from}
          to={range.to}
          basePath="/dashboard"
          preserve={preserveForRange}
        />
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Posts · ${range.label}`}
          value={rangePosts.toLocaleString()}
          subtext={
            <TrendDelta
              current={rangePosts}
              previous={prevPosts}
              comparisonLabel={range.compareLabel}
            />
          }
        />
        <StatCard
          label={`Total Views · ${range.label}`}
          value={rangeViews.toLocaleString()}
          subtext={
            <TrendDelta
              current={rangeViews}
              previous={prevViews}
              comparisonLabel={range.compareLabel}
            />
          }
        />
        <StatCard
          label={`Total Likes · ${range.label}`}
          value={rangeLikes.toLocaleString()}
          subtext={
            <TrendDelta
              current={rangeLikes}
              previous={prevLikes}
              comparisonLabel={range.compareLabel}
            />
          }
        />
        <StatCard
          label={`Total Comments · ${range.label}`}
          value={rangeComments.toLocaleString()}
          subtext={
            <TrendDelta
              current={rangeComments}
              previous={prevComments}
              comparisonLabel={range.compareLabel}
            />
          }
        />
        {!selectedCampaign && (
          <StatCard label="Active Campaigns" value={activeCampaigns} />
        )}
        <StatCard
          label={selectedCampaign ? "Creators on campaign" : "Active Creators"}
          value={totalCreators}
        />
      </div>

      {/* Views over time */}
      {rangeSpanDays >= 3 && (
        <div className="mt-6">
          <DashboardViewsChart
            data={chartData}
            subtitle={`${selectedCampaign?.name ?? "All campaigns"} · ${range.label}`}
          />
        </div>
      )}

      {/* Weekly shoutouts — independent week navigation */}
      <div className="mt-6">
        <WeeklyShoutouts
          campaignWhere={campaignWhere}
          creatorWhere={creatorVisibilityWhere(session)}
          weekOffset={weekOffset}
          params={dp}
          settingsTeamId={session.user.teamId ?? null}
        />
      </div>

      {/* Top posts — selected range and all-time, side by side */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <TopPosts
          campaignWhere={campaignWhere}
          rangeStart={range.start}
          rangeEnd={range.end}
          rangeLabel={range.label}
          platform={platform}
          top={top}
          params={dp}
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
              <p className="text-xs text-slate-400">
                By total views · {range.label}
              </p>
            </div>
            <Link
              href="/creators"
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topCreators.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No posts in this period
            </p>
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
        <TopSounds
          campaignWhere={campaignWhere}
          rangeStart={range.start}
          rangeEnd={range.end}
          rangeLabel={range.label}
        />
      </div>

      {/* Recent Campaigns */}
      {!selectedCampaign && activeCampaigns > 0 && (
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
