import { addDays, differenceInCalendarDays, format } from "date-fns";

export interface PacingPeriod {
  start: Date;
  end: Date;
  daysElapsed: number;
  daysInPeriod: number;
  /** e.g. "Jul 1 – Jul 31" or "Jun 15 – Jul 14" */
  label: string;
}

/**
 * The pacing "month": starts on the campaign's monthStartDay (1 = calendar
 * month; 15 makes periods run Jul 15 → Aug 14 for contract cycles).
 */
export function pacingPeriod(now = new Date(), startDay = 1): PacingPeriod {
  const day = Math.min(Math.max(1, startDay), 28);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
  const start =
    now >= thisMonth
      ? thisMonth
      : new Date(now.getFullYear(), now.getMonth() - 1, day);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, day);
  const daysInPeriod = differenceInCalendarDays(end, start);
  const daysElapsed = Math.min(
    differenceInCalendarDays(now, start) + 1,
    daysInPeriod,
  );
  return {
    start,
    end,
    daysElapsed,
    daysInPeriod,
    label: `${format(start, "MMM d")} – ${format(addDays(end, -1), "MMM d")}`,
  };
}

/** One shared period for a set of campaigns: exact when they agree on a
 * start day, calendar month when they're mixed. */
export function commonPacingPeriod(
  campaigns: { monthStartDay: number }[],
  now = new Date(),
): PacingPeriod {
  const days = new Set(campaigns.map((c) => c.monthStartDay));
  return pacingPeriod(now, days.size === 1 ? [...days][0] : 1);
}

/**
 * Pacing period for ONE creator on a campaign. When the membership has a
 * contractStart, their "month" cycles from that date's day-of-month (a Jul 8
 * signing paces Jul 8 → Aug 7), the first cycle starts exactly at
 * contractStart so warm-up days before it don't count against them, and a
 * future contractStart yields notStarted=true (no flags — they're not late,
 * they haven't begun). Without a contractStart this is the campaign-level
 * pacingPeriod, unchanged.
 */
export function creatorPacingPeriod(
  cc: { contractStart: Date | null },
  campaign: { monthStartDay: number },
  now = new Date(),
): PacingPeriod & { notStarted: boolean } {
  const cs = cc.contractStart;
  if (!cs) return { ...pacingPeriod(now, campaign.monthStartDay), notStarted: false };

  // Days 29–31 clamp to 28 so every cycle exists in every month.
  const anchorDay = Math.min(cs.getDate(), 28);

  if (now < cs) {
    const end = new Date(cs.getFullYear(), cs.getMonth() + 1, anchorDay);
    return {
      start: cs,
      end,
      daysElapsed: 0,
      daysInPeriod: Math.max(differenceInCalendarDays(end, cs), 1),
      label: `starts ${format(cs, "MMM d")}`,
      notStarted: true,
    };
  }

  const base = pacingPeriod(now, anchorDay);
  // First cycle: clamp to the actual contract start (e.g. contract signed
  // Jul 30 → anchor 28 → cycle Jul 28–Aug 27, but their period begins Jul 30).
  const start = base.start < cs ? cs : base.start;
  const daysInPeriod = Math.max(differenceInCalendarDays(base.end, start), 1);
  const daysElapsed = Math.min(
    differenceInCalendarDays(now, start) + 1,
    daysInPeriod,
  );
  return {
    start,
    end: base.end,
    daysElapsed,
    daysInPeriod,
    label: `${format(start, "MMM d")} – ${format(addDays(base.end, -1), "MMM d")}`,
    notStarted: false,
  };
}

/**
 * One period for a creator across their memberships: with any contract
 * starts present, the LATEST contract governs (the most recent signing is
 * the cadence being paid for right now); otherwise the campaigns' common
 * period. Pragmatic simplification — per-membership pacing math still uses
 * each membership's own period where it matters (campaign progress page).
 */
export function creatorCommonPeriod(
  memberships: {
    contractStart: Date | null;
    campaign: { monthStartDay: number };
  }[],
  now = new Date(),
): PacingPeriod & { notStarted: boolean } {
  const withContract = memberships
    .filter((m) => m.contractStart != null)
    .sort(
      (a, b) => b.contractStart!.getTime() - a.contractStart!.getTime(),
    );
  if (withContract.length > 0) {
    return creatorPacingPeriod(
      withContract[0],
      withContract[0].campaign,
      now,
    );
  }
  return {
    ...commonPacingPeriod(
      memberships.map((m) => m.campaign),
      now,
    ),
    notStarted: false,
  };
}

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
 * Per-creator monthly goal for one campaign membership. The campaign's
 * monthly goal is the number EACH creator must hit (e.g. 40/month → the
 * weekly card shows 40÷4 = 10). A per-creator override wins; with no campaign
 * goal set, fall back to the pre-existing per-creator weeklyPostTarget×4.
 *
 * The third arg is kept for call-site compatibility but no longer used — the
 * goal is per creator now, not a campaign total split across the roster.
 */
export function effectiveMonthlyGoal(
  cc: { monthlyPostGoal: number | null },
  campaign: { monthlyPostGoal: number | null; weeklyPostTarget: number },
  _activeCreatorCount?: number,
): number {
  if (cc.monthlyPostGoal != null) return cc.monthlyPostGoal;
  if (campaign.monthlyPostGoal != null) return campaign.monthlyPostGoal;
  return campaign.weeklyPostTarget * 4;
}

/**
 * Cumulative monthly pacing: checked against the period so far, not per-week,
 * so a slow Saturday made up on Sunday doesn't trigger a false flag.
 */
export function isOffPace(
  postsThisMonth: number,
  monthlyGoal: number,
  offPacePct: number,
  period: PacingPeriod,
): boolean {
  if (monthlyGoal <= 0) return false;
  const expected =
    (period.daysElapsed / period.daysInPeriod) *
    monthlyGoal *
    (offPacePct / 100);
  return postsThisMonth < expected;
}

/** Hover text for a flag badge, with the actual thresholds spelled out. */
export function flagTooltip(flag: CreatorFlag, t: PacingThresholds): string {
  switch (flag) {
    case "off_pace":
      return `Behind the cumulative goal — under ${t.offPacePct}% of where they should be by this point in the period (threshold adjustable per campaign)`;
    case "quiet":
      return `No posts in ${t.quietDays}+ days (threshold adjustable per campaign)`;
    case "new":
      return "On the campaign but hasn't posted yet";
    case "shadowbanned":
      return "Marked shadow-banned — excluded from pacing so the ban isn't read as falling behind";
  }
}

export function creatorFlags(input: {
  postsThisMonth: number;
  postsAllTime: number;
  lastPostAt: Date | null;
  monthlyGoal: number;
  thresholds: PacingThresholds;
  isShadowbanned: boolean;
  period: PacingPeriod;
  /** Contract hasn't started yet — no flags, they're not late. */
  notStarted?: boolean;
  now?: Date;
}): CreatorFlag[] {
  const now = input.now ?? new Date();
  const flags: CreatorFlag[] = [];

  if (input.notStarted) {
    // Their card label reads "starts <date>" — flagging them New/Quiet/
    // Off-pace before the contract begins is exactly the Kamryn bug.
    return flags;
  }
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
      input.period,
    )
  ) {
    flags.push("off_pace");
  }
  return flags;
}
