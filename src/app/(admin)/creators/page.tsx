import Link from "next/link";
import { Users } from "lucide-react";
import {
  creatorFlags,
  creatorCommonPeriod,
  effectiveMonthlyGoal,
  governingContractGoal,
  pacingPeriod,
  commonPacingPeriod,
} from "@/lib/pacing";
import { addDays, min as minDate } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  AGENCY_TEAM_SLUGS,
  hasAgencyWideAccess,
} from "@/lib/auth";
import { creatorVisibilityWhere, campaignVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { AddCreatorButton } from "@/components/creators/add-creator-button";
import { type CreatorPacingCardData } from "@/components/creators/creator-pacing-card";
import { CreatorsCardsClient } from "@/components/creators/creators-cards-client";
import { CampaignSwitcher } from "@/components/dashboard/campaign-switcher";
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
  // Agency-wide users (super admins + agency-team members) pick which client
  // to add a creator under; the agency team itself is excluded (creators
  // there break visibility). Client managers add to their own team only.
  const canPickTeam = hasAgencyWideAccess(session);
  const teams = canPickTeam
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
                monthStartDay: true,
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

  // Pacing windows are per creator: a contract-goal creator is measured over
  // their WHOLE contract, a monthly-pacing creator over a ≤31-day cycle. Pull
  // one superset window that covers both — back to the earliest active
  // contract start (or 32 days, whichever is older).
  const earliestContractStart = minDate([
    addDays(now, -32),
    ...creators.flatMap((c) =>
      c.campaignCreators
        .filter((cc) => cc.isActive && cc.campaign.isActive && cc.contractStart)
        .map((cc) => cc.contractStart!),
    ),
  ]);
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
            postedAt: { gte: earliestContractStart },
          },
          select: {
            creatorId: true,
            platform: true,
            campaignId: true,
            postedAt: true,
          },
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
  const monthPostsByCreator = new Map<
    string,
    { platform: string; campaignId: string | null; postedAt: Date }[]
  >();
  for (const p of monthPosts) {
    const list = monthPostsByCreator.get(p.creatorId) ?? [];
    list.push(p);
    monthPostsByCreator.set(p.creatorId, list);
  }

  const cards: (CreatorPacingCardData & {
    isActive: boolean;
    onActiveCampaign: boolean;
    hasMemberships: boolean;
    cutFromActive: boolean;
  })[] = [];
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

    // This creator's own pacing period: anchored to their latest contract
    // start when one is set, campaign month otherwise. Fixes the "started
    // last week but measured against the whole month" false off-pace.
    const creatorPeriod = creatorCommonPeriod(
      relevantCCs.map((cc) => ({
        contractStart: cc.contractStart,
        campaign: cc.campaign,
      })),
      now,
    );

    const goalPlatform = goalPlatformFor(creator);
    // Counting rule is per creator-per-campaign: all platforms when the CC
    // says so (unique content per handle), canonical platform otherwise.
    const ccByCampaign = new Map(
      relevantCCs.map((cc) => [cc.campaign.id, cc]),
    );
    const countsForGoal = (p: {
      platform: string;
      campaignId: string | null;
    }) =>
      (p.campaignId != null &&
        ccByCampaign.get(p.campaignId)?.countAllPlatforms) ||
      p.platform === goalPlatform;

    // Campaign-goal pacing wins when this creator has contract dates + a
    // contracted total: measured over the WHOLE contract (warm-up week
    // excluded from expectations), not a rolling month.
    const governing = governingContractGoal(relevantCCs, now);
    const creatorPosts = monthPostsByCreator.get(creator.id) ?? [];
    const delivered = governing
      ? creatorPosts.filter(
          (p) =>
            p.postedAt >= governing.goal.start &&
            p.postedAt < governing.goal.endExclusive &&
            countsForGoal(p),
        ).length
      : 0;
    const postsThisMonth = creatorPosts.filter(
      (p) =>
        p.postedAt >= creatorPeriod.start &&
        p.postedAt < creatorPeriod.end &&
        countsForGoal(p),
    ).length;
    const agg = aggByCreator.get(creator.id);

    cards.push({
      id: creator.id,
      name: creator.name,
      handle: creator.handle,
      isActive: creator.isActive,
      onActiveCampaign: relevantCCs.length > 0,
      hasMemberships: creator.campaignCreators.length > 0,
      cutFromActive: creator.campaignCreators.some(
        (cc) => cc.campaign.isActive && !cc.isActive,
      ),
      flags: creatorFlags({
        postsThisMonth,
        postsAllTime: agg?._count ?? 0,
        lastPostAt: agg?._max.postedAt ?? null,
        monthlyGoal,
        thresholds,
        isShadowbanned: creator.isShadowbanned,
        period: creatorPeriod,
        notStarted: governing
          ? governing.goal.notStarted
          : creatorPeriod.notStarted,
        contract: governing
          ? {
              delivered,
              expectedToDate: governing.goal.expectedToDate,
              inWarmup: governing.goal.inWarmup,
            }
          : undefined,
        now,
      }),
      postsThisMonth: governing ? delivered : postsThisMonth,
      monthlyGoal: governing ? governing.goal.totalGoal : monthlyGoal,
      periodLabel: governing
        ? `contract ${governing.goal.label}${governing.goal.inWarmup ? " · warm-up week" : ""}`
        : creatorPeriod.label,
      thresholds,
      views: agg?._sum.views ?? 0,
      likes: agg?._sum.likes ?? 0,
      comments: agg?._sum.comments ?? 0,
      campaignNames: relevantCCs.map((cc) => cc.campaign.name),
    });
  }

  // Pacing cards = active creators on an active campaign (plus brand-new
  // unassigned ones, so they don't vanish before assignment). Creators cut
  // from every campaign, or whose campaigns all ended, drop to the pill list
  // — cut means "off the main pages", their data still syncs.
  const activeCards = cards.filter(
    (c) => c.isActive && (c.onActiveCampaign || !c.hasMemberships),
  );
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
  const inactive = cards
    .filter(
      (c) => !c.isActive || (c.hasMemberships && !c.onActiveCampaign),
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      tag: !c.isActive
        ? "deactivated"
        : c.cutFromActive
          ? "cut"
          : "campaign ended",
    }));

  const totalViews = cards.reduce((sum, c) => sum + c.views, 0);
  const totalPosts = aggregates.reduce((sum, a) => sum + a._count, 0);

  return (
    <div>
      <PageHeader
        title="Creators"
        description="Campaign-goal pacing across your roster — who needs attention, who's on track"
      >
        <AddCreatorButton
          canPickTeam={canPickTeam}
          teams={teams}
          // Team pickers must choose a client every time — defaulting to their
          // own team is what put creators onto the agency team. Client managers
          // are locked to their own team server-side anyway.
          defaultTeamId={canPickTeam ? "" : session.user.teamId}
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
          {/* Campaign filter — a dropdown (per Adriel), applies to the whole
              page: pacing, flags, stats. */}
          {filterCampaigns.length > 0 && (
            <div className="mb-4">
              <CampaignSwitcher
                campaigns={filterCampaigns}
                selectedId={campaignFilter?.id}
                basePath="/creators"
              />
            </div>
          )}

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Creators" value={activeCards.length} />
            <StatCard label="Needs Attention" value={needsAttention.length} />
            <StatCard label="Total Posts" value={totalPosts.toLocaleString()} />
            <StatCard label="Total Views" value={totalViews.toLocaleString()} />
          </div>

          <CreatorsCardsClient
            needsAttention={needsAttention}
            onTrack={onTrack}
            inactive={inactive}
            periodLabel={period.label}
            legend={
              campaignFilter ? (
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
                  Off-pace = behind the cumulative goal — the creator&apos;s
                  contract (contracted videos over their contract dates,
                  first week is warm-up) when set, month-to-date otherwise ·
                  Quiet = no post in several days · New = no posts yet ·
                  Shadow-banned = excluded from pacing. Contract dates and
                  totals live in each campaign&apos;s Contract Tracker; hover
                  any flag for exact numbers.
                </>
              )
            }
          />
        </>
      )}
    </div>
  );
}
