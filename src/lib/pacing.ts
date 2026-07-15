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
 * Contract dates are stored midnight UTC (like campaign start/end), but this
 * math runs in the server's local timezone (prod pins America/Chicago) — so
 * read the date's UTC components back as a local-midnight Date before using
 * getDate()/format()/comparisons. Without this, every contract paces a day
 * early in any west-of-UTC timezone (the recurring calendarDate gotcha).
 */
function contractDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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
  const cs = cc.contractStart ? contractDate(cc.contractStart) : null;
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
 * One period for a creator across their memberships: the latest contract
 * that has ALREADY STARTED governs (the cadence being paid for right now) —
 * a pre-entered future contract on another campaign must not silence pacing
 * on a live one. With only future contracts, the soonest upcoming one wins
 * (notStarted state, "starts <date>" label). No contracts at all → the
 * campaigns' common period. Pragmatic simplification — per-membership
 * pacing math still uses each membership's own window where it matters
 * (campaign progress page).
 */
export function creatorCommonPeriod(
  memberships: {
    contractStart: Date | null;
    campaign: { monthStartDay: number };
  }[],
  now = new Date(),
): PacingPeriod & { notStarted: boolean } {
  const withContract = memberships.filter((m) => m.contractStart != null);
  if (withContract.length > 0) {
    const started = withContract
      .filter((m) => contractDate(m.contractStart!) <= now)
      .sort((a, b) => b.contractStart!.getTime() - a.contractStart!.getTime());
    const upcoming = withContract
      .filter((m) => contractDate(m.contractStart!) > now)
      .sort((a, b) => a.contractStart!.getTime() - b.contractStart!.getTime());
    const governing = started[0] ?? upcoming[0];
    return creatorPacingPeriod(governing, governing.campaign, now);
  }
  return {
    ...commonPacingPeriod(
      memberships.map((m) => m.campaign),
      now,
    ),
    notStarted: false,
  };
}

/**
 * Campaign-goal pacing (per Jacqueline, 2026-07-15): a creator's real goal is
 * their contracted video total over their contract dates — not a rolling
 * month. The weekly goal divides that total across the contract's weeks
 * AFTER the 1-week warm-up (hasWarmupWeek, on by default): the first week of
 * a contract is ramp-up and doesn't count against pacing. Expected-to-date
 * accrues linearly from the end of the warm-up, so during warm-up nobody is
 * off-pace, while posts made during warm-up still count as delivered.
 */
export interface ContractGoal {
  start: Date;
  /** Day AFTER the contract's last day — use with `postedAt < endExclusive`. */
  endExclusive: Date;
  /** Where pacing starts accruing: start + 7d when hasWarmupWeek. */
  effectiveStart: Date;
  totalGoal: number;
  weeklyGoal: number;
  expectedToDate: number;
  notStarted: boolean;
  inWarmup: boolean;
  /** e.g. "Jul 8 – Sep 30" */
  label: string;
}

export function contractGoal(
  cc: {
    contractStart: Date | null;
    contractEnd: Date | null;
    hasWarmupWeek: boolean;
    contractedTiktok: number | null;
    contractedInstagram: number | null;
  },
  now = new Date(),
): ContractGoal | null {
  if (!cc.contractStart || !cc.contractEnd) return null;
  const totalGoal = (cc.contractedTiktok ?? 0) + (cc.contractedInstagram ?? 0);
  if (totalGoal <= 0) return null;

  const start = contractDate(cc.contractStart);
  const endExclusive = addDays(contractDate(cc.contractEnd), 1);
  if (endExclusive <= start) return null;

  // A contract shorter than the warm-up week gets no warm-up — otherwise the
  // usable window would be empty.
  const warmupEnd = addDays(start, 7);
  const effectiveStart =
    cc.hasWarmupWeek && warmupEnd < endExclusive ? warmupEnd : start;

  const usableDays = Math.max(
    differenceInCalendarDays(endExclusive, effectiveStart),
    1,
  );
  const weeklyGoal = totalGoal / (usableDays / 7);
  const notStarted = now < start;
  const inWarmup = !notStarted && now < effectiveStart;
  const elapsedUsable = Math.min(
    Math.max(differenceInCalendarDays(now, effectiveStart) + 1, 0),
    usableDays,
  );
  const expectedToDate =
    notStarted || inWarmup ? 0 : (totalGoal * elapsedUsable) / usableDays;

  return {
    start,
    endExclusive,
    effectiveStart,
    totalGoal,
    weeklyGoal,
    expectedToDate,
    notStarted,
    inWarmup,
    label: `${format(start, "MMM d")} – ${format(addDays(endExclusive, -1), "MMM d")}`,
  };
}

/**
 * The contract goal that governs a creator across their memberships — same
 * rule as creatorCommonPeriod: the latest contract that has already started
 * wins; with only future contracts, the soonest upcoming one. Null when no
 * membership has contract dates + a contracted total (callers fall back to
 * monthly-goal pacing).
 */
export function governingContractGoal<
  M extends {
    contractStart: Date | null;
    contractEnd: Date | null;
    hasWarmupWeek: boolean;
    contractedTiktok: number | null;
    contractedInstagram: number | null;
  },
>(memberships: M[], now = new Date()): { goal: ContractGoal; cc: M } | null {
  const withGoals = memberships
    .map((cc) => ({ cc, goal: contractGoal(cc, now) }))
    .filter((x): x is { cc: M; goal: ContractGoal } => x.goal !== null);
  if (withGoals.length === 0) return null;
  const started = withGoals
    .filter((x) => !x.goal.notStarted)
    .sort((a, b) => b.goal.start.getTime() - a.goal.start.getTime());
  const upcoming = withGoals
    .filter((x) => x.goal.notStarted)
    .sort((a, b) => a.goal.start.getTime() - b.goal.start.getTime());
  return started[0] ?? upcoming[0];
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
  /**
   * Campaign-goal pacing: when set, off-pace is judged against the contract's
   * cumulative expectation (warm-up already excluded via expectedToDate=0)
   * instead of the monthly period math.
   */
  contract?: { delivered: number; expectedToDate: number; inWarmup?: boolean };
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
  // The warm-up week is leeway across the board — no Quiet nagging while
  // they're still ramping up.
  const inWarmup = input.contract?.inWarmup ?? false;
  if (
    !inWarmup &&
    (!input.lastPostAt ||
      differenceInCalendarDays(now, input.lastPostAt) >=
        input.thresholds.quietDays)
  ) {
    flags.push("quiet");
  }
  const offPace = input.contract
    ? input.contract.delivered <
      input.contract.expectedToDate * (input.thresholds.offPacePct / 100)
    : isOffPace(
        input.postsThisMonth,
        input.monthlyGoal,
        input.thresholds.offPacePct,
        input.period,
      );
  if (offPace) {
    flags.push("off_pace");
  }
  return flags;
}
