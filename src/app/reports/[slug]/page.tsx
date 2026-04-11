import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/shared/stat-card";
import { TierBadge } from "@/components/creators/tier-badge";
import { BarChart3 } from "lucide-react";

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const config = await prisma.weeklyReportConfig.findUnique({
    where: { publicSlug: slug },
    include: {
      campaign: {
        include: {
          campaignCreators: {
            include: { creator: true },
          },
        },
      },
    },
  });

  if (!config) notFound();

  const campaign = config.campaign;

  const metrics = await prisma.post.aggregate({
    where: { campaignId: campaign.id },
    _sum: { views: true, likes: true, comments: true, shares: true, saves: true },
    _count: true,
  });

  const topPosts = await prisma.post.findMany({
    where: { campaignId: campaign.id },
    include: { creator: { select: { handle: true } } },
    orderBy: { views: "desc" },
    take: 10,
  });

  const totalViews = metrics._sum.views ?? 0;
  const totalLikes = metrics._sum.likes ?? 0;
  const totalComments = metrics._sum.comments ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {campaign.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {format(campaign.startDate, "MMM d, yyyy")} —{" "}
            {format(campaign.endDate, "MMM d, yyyy")}
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Posts" value={metrics._count.toLocaleString()} />
          <StatCard label="Total Views" value={totalViews.toLocaleString()} />
          <StatCard label="Total Likes" value={totalLikes.toLocaleString()} />
          <StatCard label="Total Comments" value={totalComments.toLocaleString()} />
        </div>

        {/* Top Posts */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">
            Top Performing Posts
          </h2>
          <div className="mt-3 space-y-2">
            {topPosts.map((post, idx) => (
              <div
                key={post.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-500">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {post.title || "Untitled"}
                    </p>
                    <p className="text-xs text-slate-400">
                      @{post.creator.handle} ·{" "}
                      {format(post.postedAt, "MMM d")}
                    </p>
                  </div>
                </div>
                <span className="ml-4 shrink-0 text-sm font-medium text-slate-700">
                  {post.views.toLocaleString()} views
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Creators */}
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800">
            Creators ({campaign.campaignCreators.length})
          </h2>
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
                  <span className="text-sm font-medium text-slate-700">
                    @{cc.creator.handle}
                  </span>
                </div>
                <TierBadge tier={cc.creator.tier} />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-400">
          Powered by Tracker
        </p>
      </div>
    </div>
  );
}
