import { notFound } from "next/navigation";
import Link from "next/link";
import { format, addDays, subDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { canAccessCreator, campaignVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TierBadge } from "@/components/creators/tier-badge";
import { InviteCreatorButton } from "@/components/creators/invite-creator-button";
import { CreatorAccountsCard } from "@/components/creators/creator-accounts-card";
import { AssignToCampaign } from "@/components/creators/assign-to-campaign";
import { DeleteCreatorDangerZone } from "@/components/creators/delete-creator-danger-zone";
import { DeactivateCreatorToggle } from "@/components/creators/deactivate-creator-toggle";
import { SyncCreatorButton } from "@/components/creators/sync-creator-button";
import { CreatorViewsChart } from "@/components/creators/creator-views-chart";
import { CreatorWeeklyProgress } from "@/components/creators/creator-weekly-progress";
import { CreatorMonthlyProgress } from "@/components/creators/creator-monthly-progress";
import { CreatorBonusCard } from "@/components/creators/creator-bonus-card";
import { ShadowbanToggle } from "@/components/creators/shadowban-toggle";
import {
  creatorFlags,
  effectiveMonthlyGoal,
  creatorCommonPeriod,
  governingContractGoal,
} from "@/lib/pacing";
import { getWeekWindow, parseWeekOffset } from "@/lib/weeks";
import { computeViewBonuses } from "@/lib/view-bonus";
import { ThumbnailImage } from "@/components/campaigns/thumbnail-image";
import { goalPlatformFor } from "@/lib/social/goal-counting";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS, ATTRIBUTION_ENABLED } from "@/lib/constants";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DEFAULT_VIRAL_THRESHOLD = 50_000;
const CHART_WINDOWS = [28, 60, 90];

function compactViews(n: number) {
  return n >= 1_000_000
    ? `${n / 1_000_000}M`
    : n >= 1_000
      ? `${Math.round(n / 1_000)}K`
      : String(n);
}

export default async function CreatorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ creatorId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getRequiredSession();
  const { creatorId } = await params;
  const sp = await searchParams;

  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: {
      campaignCreators: {
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              isActive: true,
              weeklyPostTarget: true,
              monthlyPostGoal: true,
              offPacePct: true,
              quietDays: true,
              monthStartDay: true,
              viralThreshold: true,
              bonusCapUsd: true,
              bonusTiers: {
                select: { viewThreshold: true, amountUsd: true },
                orderBy: { viewThreshold: "asc" },
              },
            },
          },
        },
      },
      teamMember: { select: { id: true } },
      accounts: {
        include: { campaign: { select: { id: true, name: true } } },
        orderBy: [{ platform: "asc" }, { createdAt: "asc" }],
      },
      _count: { select: { posts: true } },
    },
  });

  if (!creator) notFound();

  // Visibility: super admin sees any creator; client managers see creators
  // assigned to one of their team's campaigns OR creators "homed" on their team.
  const allowed = await canAccessCreator(prisma, creator, session);
  if (!allowed) notFound();

  // Campaign filter: scopes every stat below (views, posts, chart, viral,
  // platform split) to one campaign, and drives the "socials for this
  // campaign" card. Default = all campaigns.
  const campaignParam = Array.isArray(sp.campaign) ? sp.campaign[0] : sp.campaign;
  const campaignFilter =
    creator.campaignCreators.find((cc) => cc.campaign.id === campaignParam)
      ?.campaign ?? null;
  const postWhere = {
    creatorId,
    ...(campaignFilter ? { campaignId: campaignFilter.id } : {}),
  };

  const now = new Date();
  // Week navigation: ?week=N steps back N weeks (0 = this week) so each
  // contract week can be reviewed with the arrows on the weekly card.
  const weekOffset = parseWeekOffset(sp.week);
  const weekWindow = getWeekWindow(weekOffset, now);
  const weekStart = weekWindow.start;
  const weekEnd = weekWindow.end;
  const chartParam = Number(Array.isArray(sp.chart) ? sp.chart[0] : sp.chart);
  const chartDays = CHART_WINDOWS.includes(chartParam) ? chartParam : 28;
  const chartStart = startOfDay(subDays(now, chartDays));

  // Viral = the campaign's configured threshold; across all campaigns use
  // the lowest so nothing viral is missed.
  const activeCampaignsHere = creator.campaignCreators
    .filter((cc) => cc.isActive && cc.campaign.isActive)
    .map((cc) => cc.campaign);
  const viralThreshold =
    campaignFilter?.viralThreshold ??
    (activeCampaignsHere.length
      ? Math.min(...activeCampaignsHere.map((c) => c.viralThreshold))
      : DEFAULT_VIRAL_THRESHOLD);
  // Pacing month: anchored to the creator's contract start when set (latest
  // contract governs), otherwise the campaign's configured start day
  // (calendar month when viewing all campaigns with mixed start days).
  const pacingCCs = creator.campaignCreators.filter(
    (cc) =>
      cc.isActive &&
      cc.campaign.isActive &&
      (!campaignFilter || cc.campaign.id === campaignFilter.id),
  );
  const period = creatorCommonPeriod(
    pacingCCs.map((cc) => ({
      contractStart: cc.contractStart,
      campaign: cc.campaign,
    })),
    now,
  );
  // Campaign-goal pacing wins when a contract (dates + contracted total) is
  // set: delivered vs contracted over the whole contract, warm-up week
  // excluded from expectations. Falls back to the monthly card otherwise.
  const governing = governingContractGoal(pacingCCs, now);

  const [
    totalViews,
    totalSignups,
    allCampaigns,
    recentPosts,
    viralCount,
    platformGroups,
    postsInRange,
    weekPosts,
    monthPosts,
    activeCounts,
    contractPosts,
  ] = await Promise.all([
    prisma.post.aggregate({
      where: postWhere,
      _sum: { views: true },
      _count: true,
      _max: { postedAt: true },
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
      where: postWhere,
      orderBy: { postedAt: "desc" },
      take: 10,
      include: { campaign: { select: { id: true, name: true } } },
    }),
    prisma.post.count({
      where: { ...postWhere, views: { gte: viralThreshold } },
    }),
    prisma.post.groupBy({
      by: ["platform"],
      where: postWhere,
      _sum: { views: true, likes: true, comments: true, shares: true, saves: true },
      _count: { _all: true },
    }),
    prisma.post.findMany({
      where: { ...postWhere, postedAt: { gte: chartStart } },
      select: { postedAt: true, views: true },
    }),
    prisma.post.findMany({
      where: { ...postWhere, postedAt: { gte: weekStart, lt: weekEnd } },
      select: { postedAt: true, platform: true, campaignId: true },
    }),
    prisma.post.findMany({
      where: { ...postWhere, postedAt: { gte: period.start, lt: period.end } },
      select: {
        id: true,
        platform: true,
        campaignId: true,
        views: true,
        title: true,
        link: true,
      },
    }),
    prisma.campaignCreator.groupBy({
      by: ["campaignId"],
      where: { isActive: true, creator: { isActive: true } },
      _count: true,
    }),
    governing
      ? prisma.post.findMany({
          where: {
            ...postWhere,
            postedAt: {
              gte: governing.goal.start,
              lt: governing.goal.endExclusive,
            },
          },
          select: { platform: true, campaignId: true },
        })
      : Promise.resolve([]),
  ]);
  const attributedSignups = totalSignups._sum.signupCount ?? 0;
  const hasActiveCampaign = creator.campaignCreators.some(
    (cc) => cc.campaign.isActive,
  );
  const hasHandles = Boolean(
    creator.tiktokHandle ||
      creator.instagramHandle ||
      creator.youtubeHandle ||
      creator.accounts.some((a) => a.isActive),
  );

  // Per-platform split. Shows a card for every platform the creator posts on
  // OR has a handle for, so a connected-but-quiet platform (e.g. YT Shorts)
  // is visible at zero instead of missing.
  const handlePlatforms = [
    creator.tiktokHandle && "TIKTOK",
    creator.instagramHandle && "INSTAGRAM",
    creator.youtubeHandle && "YOUTUBE",
    ...creator.accounts.filter((a) => a.isActive).map((a) => a.platform),
  ].filter((p): p is string => Boolean(p));
  const statsByPlatform = new Map(
    platformGroups.map((g) => {
      const views = g._sum.views ?? 0;
      const engagements =
        (g._sum.likes ?? 0) +
        (g._sum.comments ?? 0) +
        (g._sum.shares ?? 0) +
        (g._sum.saves ?? 0);
      return [
        g.platform as string,
        {
          views,
          posts: g._count._all,
          engagementPct: views > 0 ? (engagements / views) * 100 : null,
        },
      ];
    }),
  );
  const PLATFORM_ORDER = ["TIKTOK", "INSTAGRAM", "YOUTUBE", "FACEBOOK"];
  const platformStats = PLATFORM_ORDER.filter(
    (p) => statsByPlatform.has(p) || handlePlatforms.includes(p),
  ).map((p) => ({
    platform: p,
    ...(statsByPlatform.get(p) ?? { views: 0, posts: 0, engagementPct: null }),
  }));

  // Views over time, bucketed by day across the selected chart window.
  const dailyMap = new Map<string, number>();
  for (let i = 0; i <= chartDays; i++) {
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
  const activeCCs = pacingCCs;
  // Weekly target: with a contract, it's the contracted total spread across
  // the contract's post-warm-up weeks (the campaign goal ÷ weeks). Without
  // one, fall back to the monthly-goal ÷ 4 derivation.
  const activeCountByCampaign = new Map(
    activeCounts.map((g) => [g.campaignId, g._count]),
  );
  const weeklyTarget = governing
    ? Math.max(1, Math.round(governing.goal.weeklyGoal))
    : activeCCs.reduce(
        (sum, cc) =>
          sum +
          Math.ceil(
            effectiveMonthlyGoal(
              cc,
              cc.campaign,
              activeCountByCampaign.get(cc.campaign.id) ?? 1,
            ) / 4,
          ),
        0,
      );
  const dailyTarget = weeklyTarget / DAY_LABELS.length;
  const goalPlatform = goalPlatformFor(creator);
  const ccByCampaignId = new Map(
    creator.campaignCreators.map((cc) => [cc.campaign.id, cc]),
  );
  const countsForGoal = (p: { platform: string; campaignId: string | null }) =>
    (p.campaignId != null &&
      ccByCampaignId.get(p.campaignId)?.countAllPlatforms) ||
    p.platform === goalPlatform;
  const goalWeekPosts = weekPosts.filter(countsForGoal);
  const postsPerDay = DAY_LABELS.map((label, i) => {
    const dayStart = addDays(weekStart, i);
    const dayEnd = addDays(dayStart, 1);
    const count = goalWeekPosts.filter(
      (p) => p.postedAt >= dayStart && p.postedAt < dayEnd,
    ).length;
    return { day: label, count };
  });

  // Cumulative monthly pacing — mirrors the creators list page exactly.
  const monthlyGoal = activeCCs.reduce(
    (sum, cc) =>
      sum +
      effectiveMonthlyGoal(
        cc,
        cc.campaign,
        activeCountByCampaign.get(cc.campaign.id) ?? 1,
      ),
    0,
  );
  const thresholds = activeCCs.length
    ? {
        offPacePct: Math.min(...activeCCs.map((cc) => cc.campaign.offPacePct)),
        quietDays: Math.max(...activeCCs.map((cc) => cc.campaign.quietDays)),
      }
    : { offPacePct: 80, quietDays: 4 };
  const monthGoalPosts = monthPosts.filter(countsForGoal).length;
  const delivered = contractPosts.filter(countsForGoal).length;
  const flags = creatorFlags({
    postsThisMonth: monthGoalPosts,
    postsAllTime: totalViews._count,
    lastPostAt: totalViews._max.postedAt ?? null,
    monthlyGoal,
    thresholds,
    isShadowbanned: creator.isShadowbanned,
    period,
    notStarted: governing ? governing.goal.notStarted : period.notStarted,
    contract: governing
      ? {
          delivered,
          expectedToDate: governing.goal.expectedToDate,
          inWarmup: governing.goal.inWarmup,
        }
      : undefined,
    now,
  });

  // View-tier bonuses for this month, per campaign (respects the filter).
  const bonusSummaries = computeViewBonuses(
    monthPosts,
    activeCCs.map((cc) => ({
      id: cc.campaign.id,
      name: cc.campaign.name,
      bonusCapUsd:
        cc.campaign.bonusCapUsd === null
          ? null
          : Number(cc.campaign.bonusCapUsd),
      tiers: cc.campaign.bonusTiers.map((t) => ({
        viewThreshold: t.viewThreshold,
        amountUsd: Number(t.amountUsd),
      })),
    })),
  );

  // Weekly-card arrow links: step through past weeks, preserving the
  // campaign + chart filters.
  const weekHref = (offset: number) => {
    const qs = new URLSearchParams({
      ...(campaignFilter ? { campaign: campaignFilter.id } : {}),
      ...(chartDays !== 28 ? { chart: String(chartDays) } : {}),
      ...(offset > 0 ? { week: String(offset) } : {}),
    }).toString();
    return `/creators/${creator.id}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader title={creator.name} description={`@${creator.handle}`}>
        <DeactivateCreatorToggle
          creatorId={creator.id}
          isActive={creator.isActive}
        />
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

      {/* Social accounts — defaults + per-campaign accounts, one card */}
      <div className="mt-4">
        <CreatorAccountsCard
          creatorId={creator.id}
          tiktokHandle={creator.tiktokHandle}
          instagramHandle={creator.instagramHandle}
          youtubeHandle={creator.youtubeHandle}
          fallbackHandle={creator.handle}
          accounts={creator.accounts.map((a) => ({
            id: a.id,
            platform: a.platform,
            handle: a.handle,
            isActive: a.isActive,
            isShadowbanned: a.isShadowbanned,
            note: a.note,
            campaignId: a.campaignId,
            campaignName: a.campaign?.name ?? null,
          }))}
          campaigns={creator.campaignCreators.map((cc) => ({
            id: cc.campaign.id,
            name: cc.campaign.name,
            isActive: cc.campaign.isActive,
            onCampaign: cc.isActive,
            useDefaultHandles: cc.useDefaultHandles,
          }))}
        />
      </div>

      {/* Campaign filter — scopes the stats below to one campaign */}
      {creator.campaignCreators.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Link
            href={`/creators/${creator.id}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !campaignFilter
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All campaigns
          </Link>
          {creator.campaignCreators.map((cc) => (
            <Link
              key={cc.campaign.id}
              href={`/creators/${creator.id}?campaign=${cc.campaign.id}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                campaignFilter?.id === cc.campaign.id
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cc.campaign.name}
              {!cc.campaign.isActive && " (ended)"}
              {!cc.isActive && " (deactivated)"}
            </Link>
          ))}
        </div>
      )}

      {/* Stats */}
      <div
        className={`mt-4 grid gap-4 sm:grid-cols-2 ${ATTRIBUTION_ENABLED ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
      >
        <StatCard label="Total Posts" value={totalViews._count} />
        <StatCard
          label="Total Views"
          value={(totalViews._sum.views ?? 0).toLocaleString()}
        />
        <StatCard
          label={`Viral Videos (${compactViews(viralThreshold)}+)`}
          value={viralCount}
          subtext={
            <span title="Set per campaign under Posting requirements → Viral threshold">
              threshold set per campaign
            </span>
          }
        />
        {ATTRIBUTION_ENABLED && (
          <StatCard
            label="Attributed Signups"
            value={attributedSignups.toLocaleString()}
          />
        )}
        <StatCard
          label="Active Campaigns"
          value={
            creator.campaignCreators.filter((cc) => cc.campaign.isActive).length
          }
        />
      </div>

      {/* Platform split */}
      {platformStats.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {platformStats.map((s) => (
            <div
              key={s.platform}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-sm font-semibold text-slate-800">
                {s.platform === "YOUTUBE"
                  ? "YT Shorts"
                  : PLATFORM_LABELS[s.platform] || s.platform}
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
                <div>
                  <p className="text-2xl font-semibold text-slate-800">
                    {s.engagementPct === null
                      ? "—"
                      : `${s.engagementPct.toFixed(1)}%`}
                  </p>
                  <p className="text-xs text-slate-400">engagement</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign goal (primary pacing view) + weekly cadence. Contract-based
          when contract dates + contracted totals are set (Contract Tracker),
          monthly fallback otherwise. */}
      <div className="mt-4">
        {governing ? (
          <CreatorMonthlyProgress
            title="Campaign goal"
            postsThisMonth={delivered}
            monthlyGoal={governing.goal.totalGoal}
            flags={flags}
            scopeLabel={campaignFilter ? campaignFilter.name : "all campaigns"}
            periodLabel={`contract ${governing.goal.label}`}
            thresholds={thresholds}
            expected={governing.goal.expectedToDate}
            note={
              governing.goal.notStarted
                ? `Contract starts ${format(governing.goal.start, "MMM d")}.`
                : governing.goal.inWarmup
                  ? `Warm-up week — pacing starts ${format(governing.goal.effectiveStart, "MMM d")}; posts already count toward the goal.`
                  : null
            }
          />
        ) : (
          <CreatorMonthlyProgress
            postsThisMonth={monthGoalPosts}
            monthlyGoal={monthlyGoal}
            flags={flags}
            scopeLabel={campaignFilter ? campaignFilter.name : "all campaigns"}
            periodLabel={period.label}
            thresholds={thresholds}
          />
        )}
      </div>
      <div className="mt-4">
        <CreatorWeeklyProgress
          postsThisWeek={goalWeekPosts.length}
          weeklyTarget={weeklyTarget}
          postsPerDay={postsPerDay}
          dailyTarget={dailyTarget}
          weekLabel={`${weekWindow.label} · Mon ${format(weekStart, "MMM d")} – Sun ${format(addDays(weekStart, 6), "MMM d")}`}
          nav={{
            olderHref: weekHref(weekOffset + 1),
            newerHref: weekOffset > 0 ? weekHref(weekOffset - 1) : null,
          }}
        />
      </div>

      {/* View-tier bonuses — only for campaigns that have tiers configured */}
      {bonusSummaries.length > 0 && (
        <div className="mt-4">
          <CreatorBonusCard summaries={bonusSummaries} />
        </div>
      )}

      {/* Views over time — adjustable window */}
      <div className="mt-4">
        <CreatorViewsChart
          data={chartData}
          subtitle={`Daily views · last ${chartDays} days · ${campaignFilter ? campaignFilter.name : "all campaigns"}`}
          headerExtra={
            <div className="flex gap-1.5">
              {CHART_WINDOWS.map((d) => (
                <Link
                  key={d}
                  href={`/creators/${creator.id}?${new URLSearchParams({
                    ...(campaignFilter ? { campaign: campaignFilter.id } : {}),
                    ...(d !== 28 ? { chart: String(d) } : {}),
                  }).toString()}`}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    chartDays === d
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {d}d
                </Link>
              ))}
            </div>
          }
        />
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
                    {cc.isActive &&
                      cc.campaign.isActive &&
                      (!campaignFilter ||
                        campaignFilter.id === cc.campaign.id) && (
                        <>
                          {" "}
                          ·{" "}
                          {
                            monthPosts.filter(
                              (p) =>
                                p.campaignId === cc.campaign.id &&
                                (cc.countAllPlatforms ||
                                  p.platform === goalPlatform),
                            ).length
                          }
                          /
                          {effectiveMonthlyGoal(
                            cc,
                            cc.campaign,
                            activeCountByCampaign.get(cc.campaign.id) ?? 1,
                          )}{" "}
                          this month
                        </>
                      )}
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

      {/* Rare: exclude the whole creator from pacing. Usually you want
          per-handle "Mark SB" in Social accounts instead — creators keep
          posting on replacement handles. */}
      <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-medium text-slate-700">
            Whole-creator shadow-ban
          </p>
          <p className="text-xs text-slate-400">
            Rare — excludes them from pacing entirely. For a single banned
            handle use &quot;Mark SB&quot; in Social accounts so pacing
            continues on their other handles.
          </p>
        </div>
        <ShadowbanToggle
          creatorId={creator.id}
          isShadowbanned={creator.isShadowbanned}
        />
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
