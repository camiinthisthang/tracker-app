import { describe, expect, it } from "vitest";
import {
  commonPacingPeriod,
  creatorFlags,
  effectiveMonthlyGoal,
  isOffPace,
  pacingPeriod,
} from "@/lib/pacing";

const JUL_15 = new Date(2026, 6, 15, 12); // July 15, 2026

describe("pacingPeriod", () => {
  it("defaults to the calendar month", () => {
    const p = pacingPeriod(JUL_15, 1);
    expect(p.start).toEqual(new Date(2026, 6, 1));
    expect(p.end).toEqual(new Date(2026, 7, 1));
    expect(p.daysInPeriod).toBe(31);
    expect(p.daysElapsed).toBe(15);
    expect(p.label).toBe("Jul 1 – Jul 31");
  });

  it("starts mid-month when the contract says so", () => {
    const p = pacingPeriod(JUL_15, 12);
    expect(p.start).toEqual(new Date(2026, 6, 12));
    expect(p.end).toEqual(new Date(2026, 7, 12));
    expect(p.label).toBe("Jul 12 – Aug 11");
  });

  it("rolls back to the previous month before the start day", () => {
    const p = pacingPeriod(new Date(2026, 6, 5), 12);
    expect(p.start).toEqual(new Date(2026, 5, 12));
    expect(p.end).toEqual(new Date(2026, 6, 12));
  });

  it("clamps the start day into 1–28", () => {
    expect(pacingPeriod(JUL_15, 31).start.getDate()).toBe(28);
    expect(pacingPeriod(JUL_15, 0).start.getDate()).toBe(1);
  });
});

describe("commonPacingPeriod", () => {
  it("uses the shared start day when campaigns agree", () => {
    const p = commonPacingPeriod(
      [{ monthStartDay: 15 }, { monthStartDay: 15 }],
      new Date(2026, 6, 20),
    );
    expect(p.start.getDate()).toBe(15);
  });

  it("falls back to calendar month when start days differ", () => {
    const p = commonPacingPeriod(
      [{ monthStartDay: 15 }, { monthStartDay: 1 }],
      JUL_15,
    );
    expect(p.start.getDate()).toBe(1);
  });
});

describe("effectiveMonthlyGoal", () => {
  const campaign = { monthlyPostGoal: 40, weeklyPostTarget: 5 };

  it("splits the campaign goal evenly across creators", () => {
    expect(effectiveMonthlyGoal({ monthlyPostGoal: null }, campaign, 4)).toBe(10);
  });

  it("rounds the split up so the campaign total is always covered", () => {
    expect(effectiveMonthlyGoal({ monthlyPostGoal: null }, campaign, 6)).toBe(7);
  });

  it("lets a per-creator override win", () => {
    expect(effectiveMonthlyGoal({ monthlyPostGoal: 12 }, campaign, 4)).toBe(12);
  });

  it("falls back to weekly×4 when no campaign goal is set", () => {
    expect(
      effectiveMonthlyGoal(
        { monthlyPostGoal: null },
        { monthlyPostGoal: null, weeklyPostTarget: 5 },
        4,
      ),
    ).toBe(20);
  });
});

describe("isOffPace", () => {
  const period = pacingPeriod(JUL_15, 1); // day 15 of 31

  it("flags when below the threshold share of the pro-rated goal", () => {
    // expected = 15/31 × 40 × 0.8 ≈ 15.48 → 15 posts is off-pace
    expect(isOffPace(15, 40, 80, period)).toBe(true);
  });

  it("passes at or above the threshold", () => {
    expect(isOffPace(16, 40, 80, period)).toBe(false);
  });

  it("never flags a zero goal", () => {
    expect(isOffPace(0, 0, 80, period)).toBe(false);
  });
});

describe("creatorFlags", () => {
  const period = pacingPeriod(JUL_15, 1);
  const base = {
    postsThisMonth: 20,
    postsAllTime: 50,
    lastPostAt: new Date(2026, 6, 14),
    monthlyGoal: 40,
    thresholds: { offPacePct: 80, quietDays: 4 },
    isShadowbanned: false,
    period,
    now: JUL_15,
  };

  it("returns no flags for a healthy creator", () => {
    expect(creatorFlags(base)).toEqual([]);
  });

  it("flags new before anything else", () => {
    expect(
      creatorFlags({ ...base, postsAllTime: 0, postsThisMonth: 0 }),
    ).toEqual(["new"]);
  });

  it("flags quiet after the configured gap", () => {
    expect(
      creatorFlags({ ...base, lastPostAt: new Date(2026, 6, 11) }),
    ).toEqual(["quiet"]);
  });

  it("shadow-ban excludes the creator from all pacing flags", () => {
    expect(
      creatorFlags({
        ...base,
        isShadowbanned: true,
        postsThisMonth: 0,
        lastPostAt: null,
      }),
    ).toEqual(["shadowbanned"]);
  });

  it("can stack quiet and off-pace", () => {
    expect(
      creatorFlags({
        ...base,
        postsThisMonth: 5,
        lastPostAt: new Date(2026, 6, 1),
      }),
    ).toEqual(["quiet", "off_pace"]);
  });
});
