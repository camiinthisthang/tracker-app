import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CampaignChartsClient } from "@/components/charts/campaign-charts-client";

export default async function ChartsPage() {
  const session = await getRequiredSession();
  const teamId = session.user.teamId;

  const campaigns = await prisma.campaign.findMany({
    where: { teamId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
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
        description="Campaign performance over time"
      />
      <CampaignChartsClient campaigns={campaigns} metricsMap={metricsMap} />
    </div>
  );
}
