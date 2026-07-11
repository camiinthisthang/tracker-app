import { differenceInCalendarDays, getDaysInMonth } from "date-fns";

export type CreatorFlag = "new" | "quiet" | "off_pace" | "shadowbanned";

export const FLAG_LABELS: Record<CreatorFlag, string> = {
  new: "New",
  quiet: "Quiet",
  off_pace: "Off-pace",
  shadowbanned: "Shadow-banned",
};

export interface PacingThresholds {
  /** Off-pace when posts < elapsed×goal×(offPacePct/100). */
  offPacePct: number;
  /** Quiet after this many days without a post. */
  quietDays: number;
}

/**
 * Per-creator monthly goal for one campaign membership. Explicit override
 * wins; otherwise the campaign-wide goal splits evenly across active
 * creators; with no campaign goal set, fall back to the pre-existing
 * per-creator weeklyPostTarget×4.
 */
export function effectiveMonthlyGoal(
  cc: { monthlyPostGoal: number | null },
  campaign: { monthlyPostGoal: number | null; weeklyPostTarget: number },
  activeCreatorCount: number,
): number {
  if (cc.monthlyPostGoal != null) return cc.monthlyPostGoal;
  if (campaign.monthlyPostGoal != null) {
    return Math.max(
      1,
      Math.ceil(campaign.monthlyPostGoal / Math.max(1, activeCreatorCount)),
    );
  }
  return campaign.weeklyPostTarget * 4;
}

/**
 * Cumulative monthly pacing: checked against the month so far, not per-week,
 * so a slow Saturday made up on Sunday doesn't trigger a false flag.
 */
export function isOffPace(
  postsThisMonth: number,
  monthlyGoal: number,
  offPacePct: number,
  now = new Date(),
): boolean {
  if (monthlyGoal <= 0) return false;
  const expected =
    (now.getDate() / getDaysInMonth(now)) * monthlyGoal * (offPacePct / 100);
  return postsThisMonth < expected;
}

export function creatorFlags(input: {
  postsThisMonth: number;
  postsAllTime: number;
  lastPostAt: Date | null;
  monthlyGoal: number;
  thresholds: PacingThresholds;
  isShadowbanned: boolean;
  now?: Date;
}): CreatorFlag[] {
  const now = input.now ?? new Date();
  const flags: CreatorFlag[] = [];

  if (input.isShadowbanned) {
    // Excluded from pacing entirely — a ban shouldn't read as falling behind.
    flags.push("shadowbanned");
    return flags;
  }
  if (input.postsAllTime === 0) {
    flags.push("new");
    return flags;
  }
  if (
    !input.lastPostAt ||
    differenceInCalendarDays(now, input.lastPostAt) >= input.thresholds.quietDays
  ) {
    flags.push("quiet");
  }
  if (
    isOffPace(
      input.postsThisMonth,
      input.monthlyGoal,
      input.thresholds.offPacePct,
      now,
    )
  ) {
    flags.push("off_pace");
  }
  return flags;
}
