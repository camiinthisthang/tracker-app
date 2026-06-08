import { notFound } from "next/navigation";
import Link from "next/link";
import { format, startOfWeek, addDays, subDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { canAccessCreator, campaignVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TierBadge } from "@/components/creators/tier-badge";
import { InviteCreatorButton } from "@/components/creators/invite-creator-button";
import { CreatorSocialHandles } from "@/components/creators/creator-social-handles";
import { AssignToCampaign } from "@/components/creators/assign-to-campaign";
import { DeleteCreatorDangerZone } from "@/components/creators/delete-creator-danger-zone";
import { SyncCreatorButton } from "@/components/creators/sync-creator-button";
import { CreatorViewsChart } from "@/components/creators/creator-views-chart";
import { CreatorWeeklyProgress } from "@/components/creators/creator-weekly-progress";
import { ThumbnailImage } from "@/components/campaigns/thumbnail-image";
import { goalPlatformFor } from "@/lib/social/goal-counting";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS } from "@/lib/constants";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const VIRAL_THRESHOLD = 50_000;

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const session = await getRequiredSession();
  const { creatorId } = await params;

  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: {
      campaignCreators: {
        include: {
          campaign: { select: { id: true, name: true, isActive: true } },
        },
      },
      teamMember: { select: { id: true } },
      _count: { select: { posts: true } },
    },
  });

  if (!creator) notFound();

  // Visibility: super admin sees any creator; client managers see creators
  // assigned to one of their team's campaigns OR creators "homed" on their team.
  const allowed = await canAccessCreator(prisma, creator, session);
  if (!allowed) notFound();

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const chartStart = startOfDay(subDays(now, 28));

  const [
    totalViews,
    totalSignups,
    allCampaigns,
    recentPosts,
    viralCount,
    platformGroups,
    postsInRange,
    weekPosts,
  ] = await Promise.all([
    prisma.post.aggregate({
      where: { creatorId },
      _sum: { views: true },
    }),
    prisma.creatorAttribution.aggregate({
      where: { creatorId },
      _sum: { signupCount: true },
    }),
    prisma.campaign.findMany({
      where: campaignVisibilityWhere(session),
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.post.findMany({
      where: { creatorId },
      orderBy: { postedAt: "desc" },
      take: 10,
      include: { campaign: { select: { id: true, name: true } } },
    }),
    prisma.post.count({
      where: { creatorId, views: { gte: VIRAL_THRESHOLD } },
    }),
    prisma.post.groupBy({
      by: ["platform"],
      where: { creatorId },
      _sum: { views: true },
      _count: { _all: true },
    }),
    prisma.post.findMany({
      where: { creatorId, postedAt: { gte: chartStart } },
      select: { postedAt: true, views: true },
    }),
    prisma.post.findMany({
      where: { creatorId, postedAt: { gte: weekStart, lt: weekEnd } },
      select: { postedAt: true, platform: true },
    }),
  ]);
  const attributedSignups = totalSignups._sum.signupCount ?? 0;
  const hasActiveCampaign = creator.campaignCreators.some(
    (cc) => cc.campaign.isActive,
  );
  const hasHandles = Boolean(creator.tiktokHandle || creator.instagramHandle);

  // Per-platform split (IG vs TikTok).
  const platformStats = platformGroups.map((g) => ({
    platform: g.platform,
    views: g._sum.views ?? 0,
    posts: g._count._all,
  }));

  // Views over time (last 28 days), bucketed by day.
  const dailyMap = new Map<string, number>();
  for (let i = 0; i <= 28; i++) {
    dailyMap.set(startOfDay(addDays(chartStart, i)).toISOString(), 0);
  }
  for (const p of postsInRange) {
    const d = startOfDay(p.postedAt).toISOString();
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + p.views);
  }
  const chartData = Array.from(dailyMap.entries()).map(([date, views]) => ({
    date,
    views,
  }));

  // Weekly posting cadence (Mon–Sun), same shape the creator home uses.
  // Ring counts use the creator's goal platform only so cross-posts on the
  // other platform don't double-count.
  const activeCCs = creator.campaignCreators.filter(
    (cc) => cc.isActive && cc.campaign.isActive,
  );
  const weeklyTarget = activeCCs.reduce(
    (sum, cc) => sum + cc.videosPerDay * 5,
    0,
  );
  const dailyTarget = weeklyTarget / DAY_LABELS.length;
  const goalPlatform = goalPlatformFor(creator);
  const goalWeekPosts = weekPosts.filter((p) => p.platform === goalPlatform);
  const postsPerDay = DAY_LABELS.map((label, i) => {
    const dayStart = addDays(weekStart, i);
    const dayEnd = addDays(dayStart, 1);
    const count = goalWeekPosts.filter(
      (p) => p.postedAt >= dayStart && p.postedAt < dayEnd,
    ).length;
    return { day: label, count };
  });

  return (
    <div>
      <PageHeader title={creator.name} description={`@${creator.handle}`}>
        <SyncCreatorButton
          creatorId={creator.id}
          hasActiveCampaign={hasActiveCampaign}
          hasHandles={hasHandles}
        />
      </PageHeader>

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

      {/* Account & TikTok Status */}
      <div className="mt-4 space-y-3">
        {/* Account status */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Creator account
            </p>
            <p className="text-xs text-slate-500">
              {creator.teamMember
                ? `Signed up${creator.email ? ` as ${creator.email}` : ""}`
                : "No account yet — send them an invite link to sign up"}
            </p>
          </div>
          <InviteCreatorButton
            creatorId={creator.id}
            creatorName={creator.name}
            creatorEmail={creator.email}
            hasAccount={!!creator.teamMember}
          />
        </div>

      </div>

      {/* Social handles + manual sync trigger */}
      <div className="mt-4">
        <CreatorSocialHandles
          creatorId={creator.id}
          tiktokHandle={creator.tiktokHandle}
          instagramHandle={creator.instagramHandle}
          fallbackHandle={creator.handle}
        />
      </div>

      {/* Stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Posts" value={creator._count.posts} />
        <StatCard
          label="Total Views"
          value={(totalViews._sum.views ?? 0).toLocaleString()}
        />
        <StatCard label="Viral Videos (50K+)" value={viralCount} />
        <StatCard
          label="Attributed Signups"
          value={attributedSignups.toLocaleString()}
        />
        <StatCard
          label="Active Campaigns"
          value={
            creator.campaignCreators.filter((cc) => cc.campaign.isActive).length
          }
        />
      </div>

      {/* Platform split (IG vs TikTok) */}
      {platformStats.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {platformStats.map((s) => (
            <div
              key={s.platform}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-sm font-semibold text-slate-800">
                {PLATFORM_LABELS[s.platform] || s.platform}
              </p>
              <div className="mt-3 flex items-baseline gap-6">
                <div>
                  <p className="text-2xl font-semibold text-slate-800">
                    {s.views.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">views</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-800">
                    {s.posts.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">posts</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Weekly posting cadence */}
      <div className="mt-4">
        <CreatorWeeklyProgress
          postsThisWeek={goalWeekPosts.length}
          weeklyTarget={weeklyTarget}
          postsPerDay={postsPerDay}
          dailyTarget={dailyTarget}
        />
      </div>

      {/* Views over time (last 28 days) */}
      <div className="mt-4">
        <CreatorViewsChart data={chartData} />
      </div>

      {/* Campaigns */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Campaigns</h3>
        {creator.campaignCreators.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Not assigned to any campaigns yet — use the dropdown below to assign.
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
        <AssignToCampaign
          creatorId={creator.id}
          existingCampaignIds={creator.campaignCreators.map(
            (cc) => cc.campaign.id
          )}
          campaigns={allCampaigns}
        />
      </div>

      {/* Recent posts */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Recent posts</h3>
          {recentPosts.length > 0 && (
            <Link
              href={`/posts?creatorId=${creator.id}`}
              className="text-xs text-blue-600 hover:underline"
            >
              View all
            </Link>
          )}
        </div>
        {recentPosts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            {!hasHandles
              ? "No posts yet — the creator hasn't set their TikTok / Instagram handle."
              : !hasActiveCampaign
              ? "No posts yet. Assign this creator to an active campaign, then hit Sync posts above."
              : "No posts yet. Hit Sync posts above to pull their latest TikTok + Instagram videos."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {recentPosts.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 py-2"
              >
                {p.thumbnailUrl ? (
                  <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    <ThumbnailImage
                      src={p.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      fallbackText=""
                    />
                  </div>
                ) : (
                  <div className="h-12 w-9 shrink-0 rounded-md bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium text-slate-800 hover:text-blue-600"
                  >
                    {p.title || "(no title)"}
                  </a>
                  <p className="truncate text-xs text-slate-400">
                    {PLATFORM_LABELS[p.platform]} ·{" "}
                    {format(p.postedAt, "MMM d, yyyy")} · {p.campaign.name}
                  </p>
                </div>
                <div className="ml-3 shrink-0 text-right text-xs">
                  <p className="font-semibold text-slate-800">
                    {p.views.toLocaleString()}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    views
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {session.user.isSuperAdmin && (
        <DeleteCreatorDangerZone
          creatorId={creator.id}
          creatorName={creator.name}
        />
      )}
    </div>
  );
}
