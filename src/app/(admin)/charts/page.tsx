import { BarChart3 } from "lucide-react";
import { startOfDay, subDays, addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CampaignChartsClient } from "@/components/charts/campaign-charts-client";
import { TeamOverviewCharts } from "@/components/charts/team-overview-charts";

export default async function ChartsPage() {
  const session = await getRequiredSession();
  const teamId = session.user.teamId;

  const campaigns = await prisma.campaign.findMany({
    where: { teamId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Team-wide last-30-days view: line chart of daily totals + top 10 creators
  // + top 10 hooks.
  const chartStart = startOfDay(subDays(new Date(), 30));
  const recentPosts = await prisma.post.findMany({
    where: { creator: { teamId }, postedAt: { gte: chartStart } },
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

  // Fetch metrics for all campaigns
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
      activeCreators: number;
    }[]
  > = {};

  for (const campaign of campaigns) {
    const metrics = await prisma.campaignDailyMetric.findMany({
      where: { campaignId: campaign.id },
      orderBy: { date: "asc" },
      take: 90,
    });

    metricsMap[campaign.id] = metrics.map((m) => ({
      date: m.date.toISOString(),
      totalViews: m.totalViews,
      totalLikes: m.totalLikes,
      totalComments: m.totalComments,
      totalShares: m.totalShares,
      totalSaves: m.totalSaves,
      totalPosts: m.totalPosts,
      activeCreators: m.activeCreators,
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
