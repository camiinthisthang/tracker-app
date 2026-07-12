import { describe, expect, it } from "vitest";
import { computeViewBonuses } from "@/lib/view-bonus";

const TIERS = [
  { viewThreshold: 50_000, amountUsd: 25 },
  { viewThreshold: 100_000, amountUsd: 100 },
  { viewThreshold: 500_000, amountUsd: 250 },
  { viewThreshold: 1_000_000, amountUsd: 750 },
];

const CAMPAIGN = {
  id: "c1",
  name: "Poncho",
  bonusCapUsd: 2000 as number | null,
  tiers: TIERS,
};

function post(id: string, views: number, campaignId = "c1") {
  return { id, views, title: id, link: `https://x/${id}`, campaignId };
}

describe("computeViewBonuses", () => {
  it("a post earns the highest tier its views reach", () => {
    const [s] = computeViewBonuses([post("a", 800_000)], [CAMPAIGN]);
    expect(s.posts).toHaveLength(1);
    expect(s.posts[0].tierThreshold).toBe(500_000);
    expect(s.posts[0].amountUsd).toBe(250);
  });

  it("posts under the lowest tier earn nothing", () => {
    const [s] = computeViewBonuses([post("a", 49_999)], [CAMPAIGN]);
    expect(s.posts).toHaveLength(0);
    expect(s.earnedUsd).toBe(0);
  });

  it("sums per post and applies the monthly cap", () => {
    const posts = Array.from({ length: 4 }, (_, i) =>
      post(`p${i}`, 1_000_000),
    ); // 4 × $750 = $3,000
    const [s] = computeViewBonuses(posts, [CAMPAIGN]);
    expect(s.earnedUsd).toBe(3000);
    expect(s.payableUsd).toBe(2000);
  });

  it("no cap means earned = payable", () => {
    const [s] = computeViewBonuses(
      [post("a", 1_000_000)],
      [{ ...CAMPAIGN, bonusCapUsd: null }],
    );
    expect(s.payableUsd).toBe(750);
  });

  it("only counts posts on the campaign", () => {
    const [s] = computeViewBonuses(
      [post("a", 100_000, "other")],
      [CAMPAIGN],
    );
    expect(s.earnedUsd).toBe(0);
  });

  it("skips campaigns with no tiers", () => {
    const out = computeViewBonuses(
      [post("a", 100_000)],
      [{ ...CAMPAIGN, tiers: [] }],
    );
    expect(out).toHaveLength(0);
  });
});
