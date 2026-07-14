import { describe, expect, it } from "vitest";
import {
  commonPacingPeriod,
  creatorCommonPeriod,
  creatorFlags,
  creatorPacingPeriod,
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

describe("creatorPacingPeriod", () => {
  const campaign = { monthStartDay: 1 };

  it("falls back to the campaign period without a contract start", () => {
    const p = creatorPacingPeriod({ contractStart: null }, campaign, JUL_15);
    expect(p.start).toEqual(new Date(2026, 6, 1));
    expect(p.notStarted).toBe(false);
  });

  it("anchors the cycle to the contract start's day of month", () => {
    // Contract signed Jul 8 → cycle runs Jul 8 → Aug 7 regardless of the
    // campaign's monthStartDay.
    const p = creatorPacingPeriod(
      { contractStart: new Date(2026, 6, 8) },
      campaign,
      JUL_15,
    );
    expect(p.start).toEqual(new Date(2026, 6, 8));
    expect(p.end).toEqual(new Date(2026, 7, 8));
    expect(p.daysElapsed).toBe(8); // Jul 8–15 inclusive
    expect(p.notStarted).toBe(false);
  });

  it("first cycle starts exactly at the contract start (warm-ups excluded)", () => {
    // The Kamryn case: signed last week — she's paced over 8 days, not
    // measured against the whole month.
    const p = creatorPacingPeriod(
      { contractStart: new Date(2026, 6, 8) },
      campaign,
      JUL_15,
    );
    // expected posts at 80% threshold with a 40 goal:
    // 8/31 × 40 × 0.8 ≈ 8.3 — vs 15.5 under the old whole-month math.
    expect(isOffPace(9, 40, 80, p)).toBe(false);
    expect(isOffPace(7, 40, 80, p)).toBe(true);
  });

  it("rolls into later cycles anchored on the signing day", () => {
    const p = creatorPacingPeriod(
      { contractStart: new Date(2026, 4, 20) }, // May 20 signing
      campaign,
      JUL_15,
    );
    expect(p.start).toEqual(new Date(2026, 5, 20)); // Jun 20 → Jul 19 cycle
    expect(p.end).toEqual(new Date(2026, 6, 20));
  });

  it("clamps day-29+ signings to the 28th anchor but starts at the real date", () => {
    const p = creatorPacingPeriod(
      { contractStart: new Date(2026, 6, 30) },
      campaign,
      new Date(2026, 7, 10),
    );
    expect(p.start).toEqual(new Date(2026, 6, 30));
    expect(p.end).toEqual(new Date(2026, 7, 28));
  });

  it("marks a future contract as not started", () => {
    const p = creatorPacingPeriod(
      { contractStart: new Date(2026, 6, 20) },
      campaign,
      JUL_15,
    );
    expect(p.notStarted).toBe(true);
    expect(p.daysElapsed).toBe(0);
    expect(p.label).toBe("starts Jul 20");
  });

  it("reads UTC-midnight contract dates by their UTC day (prod stores midnight UTC, server runs west-of-UTC)", () => {
    // new Date("2026-07-08") = midnight UTC — in America/Chicago this Date's
    // LOCAL day is Jul 7. The anchor must still be the 8th.
    const p = creatorPacingPeriod(
      { contractStart: new Date("2026-07-08") },
      campaign,
      JUL_15,
    );
    expect(p.start.getDate()).toBe(8);
    expect(p.label).toBe("Jul 8 – Aug 7");
  });
});

describe("creatorCommonPeriod", () => {
  it("a future contract on one membership doesn't silence pacing on a live one", () => {
    const p = creatorCommonPeriod(
      [
        {
          contractStart: new Date(2026, 5, 1), // live since Jun 1
          campaign: { monthStartDay: 1 },
        },
        {
          contractStart: new Date(2026, 7, 1), // pre-entered Aug 1 contract
          campaign: { monthStartDay: 1 },
        },
      ],
      JUL_15,
    );
    expect(p.notStarted).toBe(false);
    expect(p.start).toEqual(new Date(2026, 6, 1)); // Jun-anchored cycle: Jul 1 – Jul 31
  });

  it("with only future contracts, the soonest one governs (not started)", () => {
    const p = creatorCommonPeriod(
      [
        {
          contractStart: new Date(2026, 7, 10),
          campaign: { monthStartDay: 1 },
        },
        {
          contractStart: new Date(2026, 6, 20),
          campaign: { monthStartDay: 1 },
        },
      ],
      JUL_15,
    );
    expect(p.notStarted).toBe(true);
    expect(p.label).toBe("starts Jul 20");
  });

  it("uses the latest contract start across memberships", () => {
    const p = creatorCommonPeriod(
      [
        {
          contractStart: new Date(2026, 5, 1),
          campaign: { monthStartDay: 1 },
        },
        {
          contractStart: new Date(2026, 6, 8),
          campaign: { monthStartDay: 1 },
        },
      ],
      JUL_15,
    );
    expect(p.start).toEqual(new Date(2026, 6, 8));
  });

  it("falls back to the campaigns' common period without contract dates", () => {
    const p = creatorCommonPeriod(
      [{ contractStart: null, campaign: { monthStartDay: 15 } }],
      new Date(2026, 6, 20),
    );
    expect(p.start.getDate()).toBe(15);
    expect(p.notStarted).toBe(false);
  });
});

describe("effectiveMonthlyGoal", () => {
  const campaign = { monthlyPostGoal: 40, weeklyPostTarget: 5 };

  it("uses the campaign goal as each creator's target (no split)", () => {
    expect(effectiveMonthlyGoal({ monthlyPostGoal: null }, campaign, 4)).toBe(40);
    // Creator count no longer changes the per-creator goal.
    expect(effectiveMonthlyGoal({ monthlyPostGoal: null }, campaign, 9)).toBe(40);
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

  it("suppresses every flag before the contract starts", () => {
    expect(
      creatorFlags({
        ...base,
        postsThisMonth: 0,
        postsAllTime: 0,
        lastPostAt: null,
        notStarted: true,
      }),
    ).toEqual([]);
  });
});
