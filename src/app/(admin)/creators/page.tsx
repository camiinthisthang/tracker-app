import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  hasAgencyWideAccess,
  AGENCY_TEAM_SLUGS,
} from "@/lib/auth";
import { creatorVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { CreatorsTableClient } from "@/components/creators/creators-table-client";
import { AddCreatorButton } from "@/components/creators/add-creator-button";

export default async function CreatorsPage() {
  const session = await getRequiredSession();

  // Agency-wide users (super admins + agency managers) can pick any client team
  // when adding a creator — except the agency team itself, which is admins-only
  // by intent. Hiding it from the picker stops the recurring mistake of adding
  // creators to DropDeck. Client managers don't pick — they're locked to their
  // own team server-side.
  const canPickClient = hasAgencyWideAccess(session);
  const teams = canPickClient
    ? await prisma.team.findMany({
        where: { slug: { notIn: AGENCY_TEAM_SLUGS } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const creators = await prisma.creator.findMany({
    where: creatorVisibilityWhere(session),
    include: {
      campaignCreators: {
        include: {
          campaign: { select: { id: true, name: true } },
        },
      },
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get total views + referrals per creator
  const creatorIds = creators.map((c) => c.id);
  const aggregateData = creatorIds.length > 0
    ? await prisma.post.groupBy({
        by: ["creatorId"],
        where: { creatorId: { in: creatorIds } },
        _sum: { views: true, referrals: true },
      })
    : [];

  // Viral count per creator (posts with 50k+ views)
  const viralData = creatorIds.length > 0
    ? await prisma.post.groupBy({
        by: ["creatorId"],
        where: { creatorId: { in: creatorIds }, views: { gte: 50000 } },
        _count: true,
      })
    : [];

  const viewsMap = new Map(
    aggregateData.map((v) => [v.creatorId, v._sum.views ?? 0])
  );
  const referralsMap = new Map(
    aggregateData.map((v) => [v.creatorId, v._sum.referrals ?? 0])
  );
  const viralMap = new Map(
    viralData.map((v) => [v.creatorId, v._count])
  );

  // Posts in the last 30 days — recent activity, to spot who has gone quiet.
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recentData =
    creatorIds.length > 0
      ? await prisma.post.groupBy({
          by: ["creatorId"],
          where: { creatorId: { in: creatorIds }, postedAt: { gte: since } },
          _count: true,
        })
      : [];
  const recentMap = new Map(recentData.map((v) => [v.creatorId, v._count]));

  const tableData = creators.map((creator) => ({
    id: creator.id,
    name: creator.name,
    handle: creator.handle,
    tier: creator.tier,
    isActive: creator.isActive,
    postCount: creator._count.posts,
    recentPosts: recentMap.get(creator.id) ?? 0,
    totalViews: viewsMap.get(creator.id) ?? 0,
    totalReferrals: referralsMap.get(creator.id) ?? 0,
    viralCount: viralMap.get(creator.id) ?? 0,
    campaignCount: creator.campaignCreators.length,
    campaigns: creator.campaignCreators.map((cc) => cc.campaign),
  }));

  const activeCount = creators.filter((c) => c.isActive).length;
  const totalViews = tableData.reduce((sum, c) => sum + c.totalViews, 0);
  const totalReferrals = tableData.reduce(
    (sum, c) => sum + c.totalReferrals,
    0
  );
  const totalPosts = tableData.reduce((sum, c) => sum + c.postCount, 0);

  return (
    <div>
      <PageHeader
        title="Creators"
        description="Manage your creator roster and leaderboard"
      >
        <AddCreatorButton
          canPickClient={canPickClient}
          teams={teams}
          // Agency-wide users must pick a client every time — defaulting to
          // their own team is what put creators onto the agency team. Client
          // managers are locked to their own team server-side anyway.
          defaultTeamId={canPickClient ? "" : session.user.teamId}
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
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Creators" value={activeCount} />
            <StatCard label="Total Posts" value={totalPosts.toLocaleString()} />
            <StatCard
              label="Total Views"
              value={totalViews.toLocaleString()}
            />
            <StatCard
              label="Total Referrals"
              value={totalReferrals.toLocaleString()}
            />
          </div>
          <CreatorsTableClient creators={tableData} />
        </>
      )}
    </div>
  );
}
