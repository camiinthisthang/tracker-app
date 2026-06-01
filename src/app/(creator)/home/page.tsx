import { format, startOfWeek, addDays, subDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { StatCard } from "@/components/shared/stat-card";
import { CreatorWeeklyProgress } from "@/components/creators/creator-weekly-progress";
import { CreatorViewsChart } from "@/components/creators/creator-views-chart";
import { CreatorMessagesFeed } from "@/components/creators/creator-messages";
import { CreatorViralVideos } from "@/components/creators/creator-viral-videos";
import { CreatorHooksFeed } from "@/components/creators/creator-hooks-feed";
import { CreatorStartGuide } from "@/components/creators/creator-start-guide";
import { BonusTracker } from "@/components/creators/bonus-tracker";
import { computeCreatorBonusSummary } from "@/lib/bonus";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const VIRAL_THRESHOLD = 50_000;

export default async function CreatorHomePage() {
  const session = await getRequiredSession();
  const creatorId = session.user.creatorId;

  if (!creatorId) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Home</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your creator profile isn&apos;t linked to an account yet. Contact your
          manager.
        </p>
      </div>
    );
  }

  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: {
      campaignCreators: {
        include: { campaign: { select: { id: true, name: true, isActive: true } } },
      },
    },
  });

  if (!creator) {
    return <p>Creator not found</p>;
  }

  // Weekly goal: sum across all active campaigns. Each CC contributes either
  // `monthlyPostGoal / 4` when an explicit per-creator goal is set, or the
  // legacy `videosPerDay × 5` baseline as a fallback for older rows. Either
  // way the number is the same regardless of weekend support — the goal is
  // weekly, just spread across 7 day rings.
  const activeCCs = creator.campaignCreators.filter(
    (cc) => cc.isActive && cc.campaign.isActive
  );
  const weeklyTarget = activeCCs.reduce((sum, cc) => {
    const fromGoal = cc.monthlyPostGoal != null ? cc.monthlyPostGoal / 4 : null;
    return sum + (fromGoal ?? cc.videosPerDay * 5);
  }, 0);
  const dailyTarget = weeklyTarget / DAY_LABELS.length;

  // Posts this week (Mon–Sun)
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);

  const weekPosts = await prisma.post.findMany({
    where: {
      creatorId,
      postedAt: { gte: weekStart, lt: weekEnd },
    },
    select: { postedAt: true },
  });

  const postsPerDay = DAY_LABELS.map((label, i) => {
    const dayStart = addDays(weekStart, i);
    const dayEnd = addDays(dayStart, 1);
    const count = weekPosts.filter(
      (p) => p.postedAt >= dayStart && p.postedAt < dayEnd
    ).length;
    return { day: label, count };
  });

  // Overall stats
  const metrics = await prisma.post.aggregate({
    where: { creatorId },
    _sum: { views: true, referrals: true },
    _count: true,
  });

  const viralCount = await prisma.post.count({
    where: { creatorId, views: { gte: VIRAL_THRESHOLD } },
  });

  const totalViews = metrics._sum.views ?? 0;
  const totalReferrals = metrics._sum.referrals ?? 0;
  const totalPosts = metrics._count;

  // Views-over-time (last 28 days)
  const chartStart = startOfDay(subDays(now, 28));
  const postsInRange = await prisma.post.findMany({
    where: { creatorId, postedAt: { gte: chartStart } },
    select: { postedAt: true, views: true },
  });

  const dailyMap = new Map<string, number>();
  for (let i = 0; i <= 28; i++) {
    const d = startOfDay(addDays(chartStart, i));
    dailyMap.set(d.toISOString(), 0);
  }
  for (const p of postsInRange) {
    const d = startOfDay(p.postedAt).toISOString();
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + p.views);
  }
  const chartData = Array.from(dailyMap.entries()).map(([date, views]) => ({
    date,
    views,
  }));

  // Viral videos
  const viralPosts = await prisma.post.findMany({
    where: { creatorId, views: { gte: VIRAL_THRESHOLD } },
    orderBy: { views: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      link: true,
      thumbnailUrl: true,
      views: true,
      referrals: true,
    },
  });

  // Messages from manager
  const messages = await prisma.creatorMessage.findMany({
    where: { creatorId },
    include: { campaign: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const serializedMessages = messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }));

  const bonusSummary = await computeCreatorBonusSummary(creatorId);

  // Published hooks for this creator's active campaigns. Sorted newest-first
  // so a fresh viral-grab from an admin shows up at the top.
  const activeCampaignIds = activeCCs.map((cc) => cc.campaign.id);
  const hooksForFeed =
    activeCampaignIds.length === 0
      ? []
      : await prisma.hook.findMany({
          where: {
            campaignId: { in: activeCampaignIds },
            publishedAt: { not: null },
            isActive: true,
          },
          select: {
            id: true,
            onScreenText: true,
            caption: true,
            videoDirection: true,
            prompt: true,
            ponchoPrompt: true,
            inspirationLink: true,
            publishedAt: true,
            campaign: { select: { name: true } },
          },
          orderBy: { publishedAt: "desc" },
          // Was take: 20 — a hardcoded UI limit, not a DB limit. Raised so
          // creators see their full hooks feed.
          take: 200,
        });
  const serializedHooks = hooksForFeed.map((h) => ({
    ...h,
    publishedAt: h.publishedAt?.toISOString() ?? null,
  }));

  const today = format(new Date(), "EEE, MMM do");

  // Show the playbook automatically until the creator has a few posts under
  // their belt. After that they know the loop and the card would be noise.
  const hasHandle = !!(creator.tiktokHandle || creator.instagramHandle);
  const showStartGuide = totalPosts < 10 || !hasHandle;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">
          Hey {session.user.name || creator.name} 👋
        </h1>
        <p className="text-sm text-slate-400">{today}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" value={totalPosts.toLocaleString()} />
        <StatCard label="Total Views" value={totalViews.toLocaleString()} />
        <StatCard label="Viral Videos (50K+)" value={viralCount} />
        <StatCard label="Total Referrals" value={totalReferrals.toLocaleString()} />
      </div>

      {/* Onboarding playbook for fresh creators */}
      {showStartGuide && (
        <div className="mt-6">
          <CreatorStartGuide
            hasHandle={hasHandle}
            hasHooks={serializedHooks.length > 0}
          />
        </div>
      )}

      {/* Progress + Messages row */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <CreatorWeeklyProgress
          postsThisWeek={weekPosts.length}
          weeklyTarget={weeklyTarget}
          postsPerDay={postsPerDay}
          dailyTarget={dailyTarget}
          historyHref="/creator-progress"
        />
        <CreatorMessagesFeed
          messages={serializedMessages}
          limit={3}
          showViewAll
        />
      </div>

      {/* Hooks for the creator's active campaigns (only renders when there's at least one). */}
      {serializedHooks.length > 0 && (
        <div className="mt-6">
          <CreatorHooksFeed hooks={serializedHooks} />
        </div>
      )}

      {/* Bonus tracker (only renders when team has active rules) */}
      {bonusSummary.rules.length > 0 && (
        <div className="mt-6">
          <BonusTracker summary={bonusSummary} />
        </div>
      )}

      {/* Views over time */}
      <div className="mt-6">
        <CreatorViewsChart data={chartData} />
      </div>

      {/* Viral videos */}
      <div className="mt-6">
        <CreatorViralVideos posts={viralPosts} />
      </div>
    </div>
  );
}
