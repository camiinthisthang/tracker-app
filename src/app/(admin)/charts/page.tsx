import { BarChart3 } from "lucide-react";
import { startOfDay, subDays, addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import {
  campaignVisibilityWhere,
  creatorVisibilityWhere,
} from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CampaignChartsClient } from "@/components/charts/campaign-charts-client";
import { TeamOverviewCharts } from "@/components/charts/team-overview-charts";

export default async function ChartsPage() {
  const session = await getRequiredSession();

  // Agency users see across every client team; client managers stay scoped.
  const campaignWhere = campaignVisibilityWhere(session);
  const creatorWhere = creatorVisibilityWhere(session);

  const campaigns = await prisma.campaign.findMany({
    where: campaignWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Team-wide last-30-days view: line chart of daily totals + top 10 creators
  // + top 10 hooks.
  const chartStart = startOfDay(subDays(new Date(), 30));
  const recentPosts = await prisma.post.findMany({
    where: { creator: creatorWhere, postedAt: { gte: chartStart } },
    select: {
      postedAt: true,
      views: true,
      hook: true,
      creator: { select: { handle: true, name: true } },
    },
  });

  const viewsByDayMap = new Map<string, number>();
  for (let i = 0; i <= 30; i++) {
    viewsByDayMap.set(
      startOfDay(addDays(chartStart, i)).toISOString(),
      0
    );
  }
  for (const p of recentPosts) {
    const k = startOfDay(p.postedAt).toISOString();
    viewsByDayMap.set(k, (viewsByDayMap.get(k) ?? 0) + p.views);
  }
  const viewsByDay = Array.from(viewsByDayMap.entries()).map(
    ([date, views]) => ({ date, views })
  );

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

  // Per-campaign daily series, bucketed by each post's publish date over the
  // last 90 days. Computed straight from the Post table (current view counts)
  // rather than CampaignDailyMetric, whose rows are cumulative campaign-to-date
  // snapshots keyed by sync date — reading those as "per day" is what produced
  // the inflated posts-per-day counts.
  const seriesStart = startOfDay(subDays(new Date(), 90));
  const campaignPosts = await prisma.post.findMany({
    where: { campaignId: { in: campaigns.map((c) => c.id) }, postedAt: { gte: seriesStart } },
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

  return (
    <div>
      <PageHeader
        title="Charts"
        description="Team-wide performance + per-campaign drill-down"
      />
      <TeamOverviewCharts
        viewsByDay={viewsByDay}
        topCreators={topCreators}
        topHooks={topHooks}
      />
      <CampaignChartsClient campaigns={campaigns} metricsMap={metricsMap} />
    </div>
  );
}
