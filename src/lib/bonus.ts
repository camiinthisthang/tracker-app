import { startOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";

// Viral threshold used by VIRAL_COUNT (per-unit): a post is "viral" when its
// view count crosses this line. Matches the default used in the viral-
// notification feature so creators see a consistent definition of viral.
export const VIRAL_VIEW_THRESHOLD = 50_000;

export interface BonusProgress {
  ruleId: string;
  label: string;
  trigger: "VIRAL_COUNT" | "REFERRAL_COUNT" | "USER_DOWNLOAD" | "USER_PAID_PLAN";
  /** USD per unit (signup, viral video, referral, paid signup). */
  ratePerUnit: number;
  /** Creator's count for this month. */
  current: number;
  /** current × ratePerUnit — how much they've already earned. */
  earnedUsd: number;
}

export interface BonusSummary {
  earnedUsd: number;
  monthlyPosts: Array<{ id: string; views: number; referrals: number; postedAt: Date }>;
  viralCount: number;
  rules: BonusProgress[];
}

/**
 * Compute the creator's bonus earnings for the current calendar month under
 * the team's active per-unit BonusRules.
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
      monthlyPosts: [],
      viralCount: 0,
      rules: [],
    };
  }

  const monthStart = startOfMonth(new Date());
  const [rules, monthlyPosts] = await Promise.all([
    prisma.bonusRule.findMany({
      where: { teamId: creator.teamId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.post.findMany({
      where: { creatorId, postedAt: { gte: monthStart } },
      select: { id: true, views: true, referrals: true, postedAt: true },
    }),
  ]);

  const viralCount = monthlyPosts.filter(
    (p) => p.views >= VIRAL_VIEW_THRESHOLD
  ).length;
  const totalReferrals = monthlyPosts.reduce(
    (s, p) => s + (p.referrals ?? 0),
    0
  );

  // PostHog attribution for download / paid-plan triggers. The current schema
  // only tracks signupCount; USER_PAID_PLAN reuses that until the attribution
  // model distinguishes paid vs free.
  const attributions = await prisma.creatorAttribution.aggregate({
    where: { creatorId, date: { gte: monthStart } },
    _sum: { signupCount: true },
  });
  const totalAttributedSignups = attributions._sum.signupCount ?? 0;

  let earnedUsd = 0;
  const ruleProgress: BonusProgress[] = [];
  for (const r of rules) {
    // Legacy VIEW_THRESHOLD rows aren't part of the per-unit model — skip.
    if (r.trigger === "VIEW_THRESHOLD") continue;

    const ratePerUnit = Number(r.amountUsd);
    let current = 0;
    if (r.trigger === "VIRAL_COUNT") current = viralCount;
    else if (r.trigger === "REFERRAL_COUNT") current = totalReferrals;
    else if (r.trigger === "USER_DOWNLOAD") current = totalAttributedSignups;
    else if (r.trigger === "USER_PAID_PLAN") current = totalAttributedSignups;

    const ruleEarnedUsd = current * ratePerUnit;
    earnedUsd += ruleEarnedUsd;

    ruleProgress.push({
      ruleId: r.id,
      label: r.label,
      trigger: r.trigger,
      ratePerUnit,
      current,
      earnedUsd: ruleEarnedUsd,
    });
  }

  return {
    earnedUsd,
    monthlyPosts,
    viralCount,
    rules: ruleProgress,
  };
}
