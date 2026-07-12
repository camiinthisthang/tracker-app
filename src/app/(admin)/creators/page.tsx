import Link from "next/link";
import { Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  creatorFlags,
  effectiveMonthlyGoal,
  pacingPeriod,
  commonPacingPeriod,
} from "@/lib/pacing";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, AGENCY_TEAM_SLUGS } from "@/lib/auth";
import { creatorVisibilityWhere, campaignVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { AddCreatorButton } from "@/components/creators/add-creator-button";
import {
  CreatorPacingCard,
  type CreatorPacingCardData,
} from "@/components/creators/creator-pacing-card";
import { goalPlatformFor } from "@/lib/social/goal-counting";

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getRequiredSession();
  const sp = await searchParams;

  // Super admins can pick any team when adding a creator — except the agency
  // team itself, which is admins-only by intent. Hiding it from the picker
  // stops the recurring mistake of adding creators to DropDeck.
  const teams = session.user.isSuperAdmin
    ? await prisma.team.findMany({
        where: { slug: { notIn: AGENCY_TEAM_SLUGS } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const [creators, filterCampaigns] = await Promise.all([
    prisma.creator.findMany({
      where: creatorVisibilityWhere(session),
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
              },
            },
          },
        },
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.campaign.findMany({
      where: campaignVisibilityWhere(session),
      select: {
        id: true,
        name: true,
        isActive: true,
        monthStartDay: true,
        offPacePct: true,
        quietDays: true,
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
  ]);

  // Campaign filter applies to the whole page: pacing, flags, stats.
  const campaignParam = Array.isArray(sp.campaign) ? sp.campaign[0] : sp.campaign;
  const campaignFilter =
    filterCampaigns.find((c) => c.id === campaignParam) ?? null;

  const now = new Date();
  // Pacing period: the selected campaign's configured month; on the
  // all-campaigns view, exact if every active campaign agrees on a start
  // day, calendar month otherwise.
  const period = campaignFilter
    ? pacingPeriod(now, campaignFilter.monthStartDay)
    : commonPacingPeriod(
        filterCampaigns.filter((c) => c.isActive),
        now,
      );

  const creatorIds = creators.map((c) => c.id);
  const postScope = campaignFilter ? { campaignId: campaignFilter.id } : {};

  const [aggregates, monthPosts] = creatorIds.length
    ? await Promise.all([
        prisma.post.groupBy({
          by: ["creatorId"],
          where: { creatorId: { in: creatorIds }, ...postScope },
          _sum: { views: true, likes: true, comments: true },
          _count: true,
          _max: { postedAt: true },
        }),
        prisma.post.findMany({
          where: {
            creatorId: { in: creatorIds },
            ...postScope,
            postedAt: { gte: period.start, lt: period.end },
          },
          select: { creatorId: true, platform: true },
        }),
      ])
    : [[], []];

  // How many active creators share each campaign — needed to split a
  // campaign-wide monthly goal evenly.
  const activeCounts = await prisma.campaignCreator.groupBy({
    by: ["campaignId"],
    where: { isActive: true, creator: { isActive: true } },
    _count: true,
  });
  const activeCountByCampaign = new Map(
    activeCounts.map((g) => [g.campaignId, g._count]),
  );

  const aggByCreator = new Map(aggregates.map((a) => [a.creatorId, a]));
  const monthPostsByCreator = new Map<string, { platform: string }[]>();
  for (const p of monthPosts) {
    const list = monthPostsByCreator.get(p.creatorId) ?? [];
    list.push(p);
    monthPostsByCreator.set(p.creatorId, list);
  }

  const cards: (CreatorPacingCardData & { isActive: boolean })[] = [];
  for (const creator of creators) {
    const relevantCCs = creator.campaignCreators.filter(
      (cc) =>
        cc.isActive &&
        cc.campaign.isActive &&
        (!campaignFilter || cc.campaign.id === campaignFilter.id),
    );
    // With a campaign selected, only creators on that campaign appear.
    if (campaignFilter && relevantCCs.length === 0) continue;

    const monthlyGoal = relevantCCs.reduce(
      (sum, cc) =>
        sum +
        effectiveMonthlyGoal(
          cc,
          cc.campaign,
          activeCountByCampaign.get(cc.campaign.id) ?? 1,
        ),
      0,
    );
    // Cross-campaign view uses the most lenient thresholds so one strict
    // campaign doesn't flag a creator who's fine on their other campaign.
    const thresholds = relevantCCs.length
      ? {
          offPacePct: Math.min(...relevantCCs.map((cc) => cc.campaign.offPacePct)),
          quietDays: Math.max(...relevantCCs.map((cc) => cc.campaign.quietDays)),
        }
      : { offPacePct: 80, quietDays: 4 };

    const goalPlatform = goalPlatformFor(creator);
    const postsThisMonth = (monthPostsByCreator.get(creator.id) ?? []).filter(
      (p) => p.platform === goalPlatform,
    ).length;
    const agg = aggByCreator.get(creator.id);

    cards.push({
      id: creator.id,
      name: creator.name,
      handle: creator.handle,
      isActive: creator.isActive,
      flags: creatorFlags({
        postsThisMonth,
        postsAllTime: agg?._count ?? 0,
        lastPostAt: agg?._max.postedAt ?? null,
        monthlyGoal,
        thresholds,
        isShadowbanned: creator.isShadowbanned,
        period,
        now,
      }),
      postsThisMonth,
      monthlyGoal,
      periodLabel: period.label,
      thresholds,
      views: agg?._sum.views ?? 0,
      likes: agg?._sum.likes ?? 0,
      comments: agg?._sum.comments ?? 0,
      campaignNames: relevantCCs.map((cc) => cc.campaign.name),
    });
  }

  const activeCards = cards.filter((c) => c.isActive);
  const needsAttention = activeCards
    .filter((c) => c.flags.length > 0)
    .sort((a, b) => {
      const ra = a.monthlyGoal > 0 ? a.postsThisMonth / a.monthlyGoal : 1;
      const rb = b.monthlyGoal > 0 ? b.postsThisMonth / b.monthlyGoal : 1;
      return ra - rb;
    });
  const onTrack = activeCards
    .filter((c) => c.flags.length === 0)
    .sort((a, b) => b.views - a.views);
  const inactive = cards.filter((c) => !c.isActive);

  const totalViews = cards.reduce((sum, c) => sum + c.views, 0);
  const totalPosts = aggregates.reduce((sum, a) => sum + a._count, 0);

  return (
    <div>
      <PageHeader
        title="Creators"
        description="Monthly pacing across your roster — who needs attention, who's on track"
      >
        <AddCreatorButton
          isSuperAdmin={session.user.isSuperAdmin}
          teams={teams}
          // Super admins must pick a client every time — defaulting to their
          // own team is what put creators onto the agency team. Non-super
          // admins are locked to their own team server-side anyway.
          defaultTeamId={session.user.isSuperAdmin ? "" : session.user.teamId}
        />
      </PageHeader>

      {creators.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No creators yet"
          description="Click 'New creator' above to add your first one."
        />
      ) : (
        <>
          {/* Campaign filter — applies to the whole page */}
          {filterCampaigns.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <Link
                href="/creators"
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  !campaignFilter
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All campaigns
              </Link>
              {filterCampaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/creators?campaign=${c.id}`}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    campaignFilter?.id === c.id
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c.name}
                  {!c.isActive && " (ended)"}
                </Link>
              ))}
            </div>
          )}

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Creators" value={activeCards.length} />
            <StatCard label="Needs Attention" value={needsAttention.length} />
            <StatCard label="Total Posts" value={totalPosts.toLocaleString()} />
            <StatCard label="Total Views" value={totalViews.toLocaleString()} />
          </div>

          {/* Needs attention */}
          {needsAttention.length > 0 && (
            <div className="mb-8">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h2 className="text-sm font-semibold text-slate-800">
                    Needs attention
                  </h2>
                  <span className="text-xs text-slate-400">
                    Pacing month: {period.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {campaignFilter ? (
                    <>
                      Off-pace = below {campaignFilter.offPacePct}% of the
                      cumulative month-to-date goal · Quiet = no post in{" "}
                      {campaignFilter.quietDays}+ days · New = no posts yet ·
                      Shadow-banned = excluded from pacing. Adjust these in{" "}
                      <Link
                        href={`/campaigns/${campaignFilter.id}/edit`}
                        className="text-blue-500 hover:underline"
                      >
                        {campaignFilter.name}&apos;s settings
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      Off-pace = behind the cumulative month-to-date goal ·
                      Quiet = no post in several days · New = no posts yet ·
                      Shadow-banned = excluded from pacing. Thresholds and the
                      month start day are set per campaign (Campaigns → Edit →
                      Posting requirements); hover any flag for exact numbers.
                    </>
                  )}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {needsAttention.map((c) => (
                  <CreatorPacingCard key={c.id} creator={c} />
                ))}
              </div>
            </div>
          )}

          {/* On track */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-slate-800">On track</h2>
            </div>
            {onTrack.length === 0 ? (
              <p className="text-sm text-slate-400">
                No one&apos;s fully on track yet this month.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {onTrack.map((c) => (
                  <CreatorPacingCard key={c.id} creator={c} />
                ))}
              </div>
            )}
          </div>

          {/* Inactive roster */}
          {inactive.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-2 text-sm font-semibold text-slate-500">
                Inactive
              </h2>
              <div className="flex flex-wrap gap-2">
                {inactive.map((c) => (
                  <Link
                    key={c.id}
                    href={`/creators/${c.id}`}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 hover:bg-slate-200"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
