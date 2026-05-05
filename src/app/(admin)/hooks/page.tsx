import { Sparkles, TrendingUp, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  WorkshopHooksManager,
  type WorkshopHookRow,
} from "@/components/hooks/workshop-hooks-manager";

interface HookStat {
  hook: string;
  postCount: number;
  totalViews: number;
  totalReferrals: number;
  avgViews: number;
  avgReferrals: number;
  conversionRate: number;
}

export default async function HooksPage() {
  const session = await getRequiredSession();
  const canManage = hasAgencyWideAccess(session);

  // Hook visibility: agency users see everything, client managers see only
  // their own team's hooks (mirrors the rule on the API).
  const hookWhere = canManage ? {} : { teamId: session.user.teamId };

  // Campaigns that this user can publish hooks to.
  const visibleCampaignsForPicker = await prisma.campaign.findMany({
    where: campaignVisibilityWhere(session),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [hooks, uploadsByHook] = await Promise.all([
    prisma.hook.findMany({
      where: { ...hookWhere, isActive: true },
      include: {
        campaign: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.upload.groupBy({
      by: ["hookId"],
      where: { hookId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const uploadCountByHookId = new Map<string, number>();
  for (const u of uploadsByHook) {
    if (u.hookId) uploadCountByHookId.set(u.hookId, u._count._all);
  }

  const toRow = (h: (typeof hooks)[number]): WorkshopHookRow => ({
    id: h.id,
    onScreenText: h.onScreenText,
    caption: h.caption,
    videoDirection: h.videoDirection,
    prompt: h.prompt,
    campaignId: h.campaignId,
    campaign: h.campaign,
    publishedAt: h.publishedAt?.toISOString() ?? null,
    createdAt: h.createdAt.toISOString(),
    createdBy: h.createdBy,
    isActive: h.isActive,
    usedByCount: uploadCountByHookId.get(h.id) ?? 0,
  });

  const workshop = hooks.filter((h) => h.publishedAt === null).map(toRow);
  const published = hooks.filter((h) => h.publishedAt !== null).map(toRow);

  // Get all posts with hooks (analytics path — unchanged, visibility-scoped).
  const posts = await prisma.post.findMany({
    where: {
      campaign: campaignVisibilityWhere(session),
      hook: { not: null },
    },
    select: {
      hook: true,
      views: true,
      referrals: true,
    },
  });

  // Aggregate by hook
  const byHook = new Map<
    string,
    { postCount: number; totalViews: number; totalReferrals: number }
  >();

  for (const post of posts) {
    if (!post.hook) continue;
    const existing = byHook.get(post.hook) || {
      postCount: 0,
      totalViews: 0,
      totalReferrals: 0,
    };
    existing.postCount += 1;
    existing.totalViews += post.views;
    existing.totalReferrals += post.referrals;
    byHook.set(post.hook, existing);
  }

  const hookStats: HookStat[] = Array.from(byHook.entries()).map(
    ([hook, data]) => ({
      hook,
      postCount: data.postCount,
      totalViews: data.totalViews,
      totalReferrals: data.totalReferrals,
      avgViews: Math.round(data.totalViews / data.postCount),
      avgReferrals: Math.round(data.totalReferrals / data.postCount),
      conversionRate:
        data.totalViews > 0
          ? (data.totalReferrals / data.totalViews) * 100
          : 0,
    })
  );

  // Sort by total referrals (the success metric)
  hookStats.sort((a, b) => b.totalReferrals - a.totalReferrals);

  const topHook = hookStats[0];
  const totalPosts = hookStats.reduce((s, h) => s + h.postCount, 0);
  const totalReferrals = hookStats.reduce((s, h) => s + h.totalReferrals, 0);

  // Top performing posts for the winning hook
  const topHookPosts = topHook
    ? await prisma.post.findMany({
        where: {
          campaign: campaignVisibilityWhere(session),
          hook: topHook.hook,
        },
        include: {
          creator: { select: { handle: true } },
          campaign: { select: { name: true } },
        },
        orderBy: { referrals: "desc" },
        take: 5,
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Hooks"
        description="Define the hooks creators can tag videos with, and see which ones perform."
      />

      {canManage && (
        <WorkshopHooksManager
          workshop={workshop}
          published={published}
          campaigns={visibleCampaignsForPicker}
        />
      )}

      {hookStats.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No hook data yet"
          description="Tag posts with hooks to start tracking which patterns work best."
        />
      ) : (
        <>
          {/* Summary */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Unique hooks tracked" value={hookStats.length} />
            <StatCard label="Posts analyzed" value={totalPosts.toLocaleString()} />
            <StatCard
              label="Total referrals attributed"
              value={totalReferrals.toLocaleString()}
            />
          </div>

          {/* Winner callout */}
          {topHook && (
            <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-blue-50 p-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <TrendingUp className="h-3.5 w-3.5" />
                Top performing hook
              </div>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                &ldquo;{topHook.hook}&rdquo;
              </h3>
              <div className="mt-4 flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Posts</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {topHook.postCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total views</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {topHook.totalViews.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total referrals</p>
                  <p className="text-lg font-semibold text-emerald-600">
                    {topHook.totalReferrals.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Conversion rate</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {topHook.conversionRate.toFixed(2)}%
                  </p>
                </div>
              </div>

              {topHookPosts.length > 0 && (
                <div className="mt-6 border-t border-emerald-200 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Best posts using this hook
                  </p>
                  <div className="space-y-1.5">
                    {topHookPosts.map((p) => (
                      <a
                        key={p.id}
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2 text-sm hover:bg-white"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-700">
                            {p.title || "Untitled"}
                          </p>
                          <p className="text-xs text-slate-400">
                            @{p.creator.handle} · {p.campaign.name}
                          </p>
                        </div>
                        <div className="ml-4 flex shrink-0 items-center gap-3 text-xs">
                          <span className="text-slate-500">
                            {p.views.toLocaleString()} views
                          </span>
                          <span className="font-semibold text-emerald-600">
                            {p.referrals.toLocaleString()} refs
                          </span>
                          <ExternalLink className="h-3 w-3 text-slate-400" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full leaderboard */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-800">
                All hooks by performance
              </h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-gray-500">
                    Rank
                  </th>
                  <th className="px-5 py-3 text-xs font-medium text-gray-500">
                    Hook
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                    Posts
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                    Total views
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                    Avg views
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                    Total referrals
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                    Conv. rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {hookStats.map((h, i) => (
                  <tr
                    key={h.hook}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="px-5 py-3 text-xs font-medium text-slate-400">
                      #{i + 1}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-700">
                      {h.hook}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-slate-600">
                      {h.postCount}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-slate-700">
                      {h.totalViews.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-slate-500">
                      {h.avgViews.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-emerald-600">
                      {h.totalReferrals.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right text-sm text-slate-700">
                      {h.conversionRate.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
