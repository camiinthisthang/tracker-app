import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { startOfDay, subDays, addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import {
  campaignVisibilityWhere,
  creatorVisibilityWhere,
} from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { CampaignChartsClient } from "@/components/charts/campaign-charts-client";
import { TeamOverviewCharts } from "@/components/charts/team-overview-charts";
import { parseDateRange } from "@/lib/date-range";
import { dashboardUrl } from "@/lib/dashboard-url";

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getRequiredSession();
  const params = await searchParams;

  // Agency users see across every client team; client managers stay scoped.
  const campaignWhere = campaignVisibilityWhere(session);
  const creatorWhere = creatorVisibilityWhere(session);

  const campaigns = await prisma.campaign.findMany({
    where: campaignWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Arriving from the dashboard pre-fills campaign + date range; both stay
  // fully adjustable here. With no explicit range the overview defaults to
  // the last 30 days (and the per-campaign drill-down to 90), as before.
  const campaignParam = Array.isArray(params.campaign)
    ? params.campaign[0]
    : params.campaign;
  const selectedCampaign =
    campaigns.find((c) => c.id === campaignParam) ?? null;
  const hasExplicitRange = Boolean(params.range);
  const range = hasExplicitRange ? parseDateRange(params) : null;

  const overviewStart = range
    ? startOfDay(range.start)
    : startOfDay(subDays(new Date(), 30));
  const overviewEnd = range ? range.end : new Date();
  const windowLabel = range ? range.label : "Last 30 days";

  const recentPosts = await prisma.post.findMany({
    where: {
      creator: creatorWhere,
      ...(selectedCampaign ? { campaignId: selectedCampaign.id } : {}),
      postedAt: { gte: overviewStart, lt: overviewEnd },
    },
    select: {
      postedAt: true,
      views: true,
      likes: true,
      comments: true,
      shares: true,
      saves: true,
      hook: true,
      creator: { select: { handle: true, name: true } },
    },
  });

  type OverviewDay = {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  const byDay = new Map<string, OverviewDay>();
  for (
    let day = overviewStart;
    day < overviewEnd;
    day = addDays(day, 1)
  ) {
    byDay.set(day.toISOString(), { views: 0, likes: 0, comments: 0, shares: 0 });
  }
  for (const p of recentPosts) {
    const k = startOfDay(p.postedAt).toISOString();
    const cur = byDay.get(k) ?? { views: 0, likes: 0, comments: 0, shares: 0 };
    cur.views += p.views;
    cur.likes += p.likes;
    cur.comments += p.comments;
    cur.shares += p.shares;
    byDay.set(k, cur);
  }
  const viewsByDay = Array.from(byDay.entries()).map(([date, v]) => ({
    date,
    views: v.views,
  }));
  const engagementByDay = Array.from(byDay.entries()).map(([date, v]) => ({
    date,
    likes: v.likes,
    comments: v.comments,
    shares: v.shares,
  }));

  const creatorViews = new Map<string, number>();
  for (const p of recentPosts) {
    const key = `@${p.creator.handle}`;
    creatorViews.set(key, (creatorViews.get(key) ?? 0) + p.views);
  }
  const topCreators = Array.from(creatorViews.entries())
    .map(([label, views]) => ({ label, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const hookViews = new Map<string, number>();
  for (const p of recentPosts) {
    if (!p.hook) continue;
    hookViews.set(p.hook, (hookViews.get(p.hook) ?? 0) + p.views);
  }
  const topHooks = Array.from(hookViews.entries())
    .map(([label, views]) => ({ label, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const dashboardHref = dashboardUrl({
    campaign: selectedCampaign?.id,
    range: range?.key,
    from: range?.from,
    to: range?.to,
  });

  if (campaigns.length === 0) {
    return (
      <div>
        <PageHeader
          title="Charts"
          description="Campaign performance over time"
        />
        <EmptyState
          icon={BarChart3}
          title="No campaigns yet"
          description="Create a campaign and sync data to see charts."
        />
      </div>
    );
  }

  // Per-campaign daily series, bucketed by each post's publish date. Computed
  // straight from the Post table (current view counts) rather than
  // CampaignDailyMetric, whose rows are cumulative campaign-to-date snapshots
  // keyed by sync date — reading those as "per day" is what produced the
  // inflated posts-per-day counts.
  const seriesStart = range
    ? startOfDay(range.start)
    : startOfDay(subDays(new Date(), 90));
  const seriesEnd = range ? range.end : new Date();
  const campaignPosts = await prisma.post.findMany({
    where: {
      campaignId: { in: campaigns.map((c) => c.id) },
      postedAt: { gte: seriesStart, lt: seriesEnd },
    },
    select: {
      campaignId: true,
      postedAt: true,
      views: true,
      likes: true,
      comments: true,
      shares: true,
      saves: true,
    },
  });

  type DayAgg = {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    posts: number;
  };
  const byCampaignDay = new Map<string, Map<string, DayAgg>>();
  for (const p of campaignPosts) {
    if (!p.campaignId) continue;
    const dayKey = startOfDay(p.postedAt).toISOString();
    let days = byCampaignDay.get(p.campaignId);
    if (!days) {
      days = new Map();
      byCampaignDay.set(p.campaignId, days);
    }
    const cur =
      days.get(dayKey) ??
      { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0 };
    cur.views += p.views;
    cur.likes += p.likes;
    cur.comments += p.comments;
    cur.shares += p.shares;
    cur.saves += p.saves;
    cur.posts += 1;
    days.set(dayKey, cur);
  }

  const metricsMap: Record<
    string,
    {
      date: string;
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      totalShares: number;
      totalSaves: number;
      totalPosts: number;
    }[]
  > = {};
  for (const campaign of campaigns) {
    const days = byCampaignDay.get(campaign.id) ?? new Map<string, DayAgg>();
    metricsMap[campaign.id] = Array.from(days.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        totalViews: v.views,
        totalLikes: v.likes,
        totalComments: v.comments,
        totalShares: v.shares,
        totalSaves: v.saves,
        totalPosts: v.posts,
      }));
  }

  const preserve: Record<string, string> = {};
  if (selectedCampaign) preserve.campaign = selectedCampaign.id;

  return (
    <div>
      <PageHeader
        title="Charts"
        description={
          selectedCampaign
            ? `${selectedCampaign.name} · ${windowLabel}`
            : `Team-wide performance + per-campaign drill-down · ${windowLabel}`
        }
      >
        <Link
          href={dashboardHref}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>
      </PageHeader>

      <div className="mb-4">
        <DateRangeFilter
          rangeKey={range?.key ?? ""}
          from={range?.from}
          to={range?.to}
          basePath="/charts"
          preserve={preserve}
        />
      </div>

      <TeamOverviewCharts
        viewsByDay={viewsByDay}
        engagementByDay={engagementByDay}
        topCreators={topCreators}
        topHooks={topHooks}
        windowLabel={windowLabel}
        scopeLabel={selectedCampaign?.name ?? "every campaign"}
      />
      <CampaignChartsClient
        campaigns={campaigns}
        metricsMap={metricsMap}
        initialCampaignId={selectedCampaign?.id}
      />
    </div>
  );
}
