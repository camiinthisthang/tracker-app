import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import {
  campaignVisibilityWhere,
  creatorVisibilityWhere,
} from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TierBadge } from "@/components/creators/tier-badge";
import { PLATFORM_LABELS } from "@/lib/constants";

export default async function DashboardPage() {
  const session = await getRequiredSession();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

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
    totalPostsThisWeek,
    viewsThisWeek,
    topPosts,
    topCreators,
  ] = await Promise.all([
    prisma.campaign.count({ where: { ...campaignWhere, isActive: true } }),
    prisma.creator.count({ where: creatorWhere }),
    prisma.post.count({
      where: { campaign: campaignWhere, postedAt: { gte: sevenDaysAgo } },
    }),
    prisma.post.aggregate({
      where: { campaign: campaignWhere, postedAt: { gte: sevenDaysAgo } },
      _sum: { views: true },
    }),
    prisma.post.findMany({
      where: { campaign: campaignWhere },
      include: {
        creator: { select: { handle: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { views: "desc" },
      take: 5,
    }),
    prisma.creator.findMany({
      where: creatorWhere,
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { tier: "desc" },
      take: 5,
    }),
  ]);

  const weeklyViews = viewsThisWeek._sum.views ?? 0;

  const attributedThisWeek = await prisma.creatorAttribution.aggregate({
    where: {
      creator: creatorVisibilityWhere(session),
      date: { gte: sevenDaysAgo },
    },
    _sum: { signupCount: true },
  });
  const signupsThisWeek = attributedThisWeek._sum.signupCount ?? 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name || "there"}`}
      />

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active Campaigns" value={activeCampaigns} />
        <StatCard label="Active Creators" value={totalCreators} />
        <StatCard label="Posts This Week" value={totalPostsThisWeek.toLocaleString()} />
        <StatCard label="Views This Week" value={weeklyViews.toLocaleString()} />
        <StatCard
          label="Attributed Signups (7d)"
          value={signupsThisWeek.toLocaleString()}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Top Performing Posts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              Top Performing Posts
            </h3>
            <Link
              href="/posts"
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {topPosts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No posts yet</p>
          ) : (
            <div className="mt-3 space-y-2">
              {topPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {post.title || "Untitled post"}
                    </p>
                    <p className="text-xs text-slate-400">
                      @{post.creator.handle} · {post.campaign.name} ·{" "}
                      {PLATFORM_LABELS[post.platform]}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">
                      {post.views.toLocaleString()} views
                    </span>
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Creators */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              Top Creators
            </h3>
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
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-500">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {creator.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        @{creator.handle} · {creator._count.posts} posts
                      </p>
                    </div>
                  </div>
                  <TierBadge tier={creator.tier} />
                </Link>
              ))}
            </div>
          )}
        </div>
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
