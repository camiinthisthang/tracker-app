import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TierBadge } from "@/components/creators/tier-badge";
import { ConnectTikTokButton } from "@/components/creators/connect-tiktok-button";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS } from "@/lib/constants";

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const session = await getRequiredSession();
  const { creatorId } = await params;

  const creator = await prisma.creator.findFirst({
    where: { id: creatorId, teamId: session.user.teamId },
    include: {
      campaignCreators: {
        include: {
          campaign: { select: { id: true, name: true, isActive: true } },
        },
      },
      _count: { select: { posts: true } },
    },
  });

  if (!creator) notFound();

  const totalViews = await prisma.post.aggregate({
    where: { creatorId },
    _sum: { views: true },
  });

  return (
    <div>
      <PageHeader title={creator.name} description={`@${creator.handle}`} />

      {/* Profile Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-xl font-semibold text-slate-600">
            {creator.name[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {creator.name}
            </h2>
            <p className="text-sm text-slate-500">@{creator.handle}</p>
            <div className="mt-2 flex items-center gap-2">
              <TierBadge tier={creator.tier} />
              <Badge
                className={
                  creator.isActive
                    ? "bg-green-50 text-green-600"
                    : "bg-slate-100 text-slate-500"
                }
              >
                {creator.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="mt-4">
        <ConnectTikTokButton
          creatorId={creator.id}
          isConnected={!!creator.tiktokAccessToken}
          tiktokUsername={creator.tiktokUsername}
          connectedAt={creator.tiktokConnectedAt?.toISOString() || null}
        />
      </div>

      {/* Stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Posts" value={creator._count.posts} />
        <StatCard
          label="Total Views"
          value={(totalViews._sum.views ?? 0).toLocaleString()}
        />
        <StatCard
          label="Active Campaigns"
          value={
            creator.campaignCreators.filter((cc) => cc.campaign.isActive).length
          }
        />
      </div>

      {/* Campaigns */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Campaigns</h3>
        {creator.campaignCreators.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Not assigned to any campaigns
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {creator.campaignCreators.map((cc) => (
              <div
                key={cc.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {cc.campaign.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {PLATFORM_LABELS[cc.platform]} · {cc.videosPerDay}{" "}
                    videos/day
                  </p>
                </div>
                <Badge
                  className={
                    cc.campaign.isActive
                      ? "bg-green-50 text-green-600"
                      : "bg-slate-100 text-slate-500"
                  }
                >
                  {cc.campaign.isActive ? "Active" : "Ended"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
