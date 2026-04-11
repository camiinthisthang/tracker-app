import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { SyncButton } from "@/components/campaigns/sync-button";
import { TierBadge } from "@/components/creators/tier-badge";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS } from "@/lib/constants";

export default async function CampaignOverviewPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, teamId: session.user.teamId },
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
    _sum: { views: true, likes: true, comments: true, shares: true, saves: true },
  });

  const totalViews = metrics._sum.views ?? 0;
  const totalLikes = metrics._sum.likes ?? 0;
  const totalComments = metrics._sum.comments ?? 0;

  const engagementRate =
    totalViews > 0
      ? (((totalLikes + totalComments) / totalViews) * 100).toFixed(2)
      : "0.00";

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

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" value={campaign._count.posts.toLocaleString()} />
        <StatCard
          label="Total Views"
          value={totalViews.toLocaleString()}
        />
        <StatCard
          label="Total Likes"
          value={totalLikes.toLocaleString()}
        />
        <StatCard
          label="Engagement Rate"
          value={`${engagementRate}%`}
        />
      </div>

      {/* Campaign Info */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Details */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-800">
            Campaign Details
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <Badge
                className={
                  campaign.isActive
                    ? "bg-green-50 text-green-600"
                    : "bg-slate-100 text-slate-500"
                }
              >
                {campaign.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Weekly Target</span>
              <span className="text-slate-700">
                {campaign.weeklyPostTarget} posts
              </span>
            </div>
            {campaign.ugcEngineer && (
              <div className="flex justify-between">
                <span className="text-slate-500">UGC Engineer</span>
                <span className="text-slate-700">{campaign.ugcEngineer}</span>
              </div>
            )}
            {campaign.hashtags.length > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Hashtags</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {campaign.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {campaign.lastSyncAt && (
              <div className="flex justify-between">
                <span className="text-slate-500">Last Sync</span>
                <span className="text-slate-700">
                  {format(campaign.lastSyncAt, "MMM d, yyyy h:mm a")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Creators */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-800">
            Creators ({campaign.campaignCreators.length})
          </h3>
          {campaign.campaignCreators.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              No creators assigned to this campaign yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {campaign.campaignCreators.map((cc) => (
                <div
                  key={cc.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                      {cc.creator.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {cc.creator.handle}
                      </p>
                      <p className="text-xs text-slate-400">
                        {PLATFORM_LABELS[cc.platform]} ·{" "}
                        {cc.videosPerDay} videos/day
                      </p>
                    </div>
                  </div>
                  <TierBadge tier={cc.creator.tier} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
