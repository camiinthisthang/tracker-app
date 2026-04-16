import { startOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";

// Viral threshold used for VIRAL_COUNT rules. Matches the default used in the
// viral-notification feature — keeping them consistent avoids confusing
// creators about what counts as viral.
export const VIRAL_VIEW_THRESHOLD = 50_000;

export interface BonusProgress {
  ruleId: string;
  label: string;
  trigger: "VIEW_THRESHOLD" | "VIRAL_COUNT" | "REFERRAL_COUNT" | "USER_DOWNLOAD" | "USER_PAID_PLAN";
  threshold: number;
  amountUsd: number;
  progress: number; // 0–1
  current: number;
  isEarned: boolean;
}

export interface BonusSummary {
  earnedUsd: number;
  totalPossibleUsd: number;
  monthlyPosts: Array<{ id: string; views: number; referrals: number; postedAt: Date }>;
  viralCount: number;
  maxSinglePostViews: number;
  rules: BonusProgress[];
  nextMilestone: BonusProgress | null;
}

/**
 * Compute the creator's bonus progress for the current calendar month, based
 * on the team's active BonusRules.
 */
export async function computeCreatorBonusSummary(
  creatorId: string
): Promise<BonusSummary> {
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    select: { teamId: true },
  });
  if (!creator) {
    return {
      earnedUsd: 0,
      totalPossibleUsd: 0,
      monthlyPosts: [],
      viralCount: 0,
      maxSinglePostViews: 0,
      rules: [],
      nextMilestone: null,
    };
  }

  const monthStart = startOfMonth(new Date());
  const [rules, monthlyPosts] = await Promise.all([
    prisma.bonusRule.findMany({
      where: { teamId: creator.teamId, isActive: true },
      orderBy: { threshold: "asc" },
    }),
    prisma.post.findMany({
      where: { creatorId, postedAt: { gte: monthStart } },
      select: { id: true, views: true, referrals: true, postedAt: true },
    }),
  ]);

  const viralCount = monthlyPosts.filter(
    (p) => p.views >= VIRAL_VIEW_THRESHOLD
  ).length;
  const maxSinglePostViews = monthlyPosts.reduce(
    (m, p) => (p.views > m ? p.views : m),
    0
  );
  const totalReferrals = monthlyPosts.reduce(
    (s, p) => s + (p.referrals ?? 0),
    0
  );

  // PostHog-sourced attribution for download / paid-plan triggers
  const attributions = await prisma.creatorAttribution.aggregate({
    where: { creatorId, date: { gte: monthStart } },
    _sum: { signupCount: true },
  });
  const totalAttributedSignups = attributions._sum.signupCount ?? 0;

  let earnedUsd = 0;
  let totalPossibleUsd = 0;

  const ruleProgress: BonusProgress[] = rules.map((r) => {
    const amountUsd = Number(r.amountUsd);
    totalPossibleUsd += amountUsd;
    let current = 0;
    if (r.trigger === "VIEW_THRESHOLD") current = maxSinglePostViews;
    else if (r.trigger === "VIRAL_COUNT") current = viralCount;
    else if (r.trigger === "REFERRAL_COUNT") current = totalReferrals;
    else if (r.trigger === "USER_DOWNLOAD") current = totalAttributedSignups;
    else if (r.trigger === "USER_PAID_PLAN") current = totalAttributedSignups;

    const isEarned = current >= r.threshold;
    if (isEarned) earnedUsd += amountUsd;

    return {
      ruleId: r.id,
      label: r.label,
      trigger: r.trigger,
      threshold: r.threshold,
      amountUsd,
      progress: r.threshold > 0 ? Math.min(current / r.threshold, 1) : 0,
      current,
      isEarned,
    };
  });

  const nextMilestone =
    ruleProgress
      .filter((r) => !r.isEarned)
      .sort((a, b) => b.progress - a.progress)[0] ?? null;

  return {
    earnedUsd,
    totalPossibleUsd,
    monthlyPosts,
    viralCount,
    maxSinglePostViews,
    rules: ruleProgress,
    nextMilestone,
  };
}
