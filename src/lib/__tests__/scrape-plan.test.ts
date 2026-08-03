import { describe, it, expect } from "vitest";
import {
  planHandleScrape,
  DEEP_SCRAPE_INTERVAL_MS,
  HANDLE_FRESH_WINDOW_CRON_MS,
  HANDLE_FRESH_WINDOW_MANUAL_MS,
} from "@/lib/social/scrape-plan";

const NOW = Date.UTC(2026, 6, 22, 6, 0, 0);
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000);

describe("planHandleScrape", () => {
  it("deep-scrapes a handle with no state (brand new)", () => {
    expect(planHandleScrape(undefined, NOW, HANDLE_FRESH_WINDOW_CRON_MS)).toBe(
      "deep"
    );
  });

  it("skips a handle scraped successfully within the freshness window", () => {
    const state = { lastSuccessAt: hoursAgo(2), lastDeepAt: daysAgo(2) };
    expect(planHandleScrape(state, NOW, HANDLE_FRESH_WINDOW_CRON_MS)).toBe(
      "skip"
    );
  });

  it("never skips when the window is 0", () => {
    const state = { lastSuccessAt: hoursAgo(0.01), lastDeepAt: daysAgo(2) };
    expect(planHandleScrape(state, NOW, 0)).toBe("shallow");
  });

  it("scrapes shallow when last success is stale but the deep pass is recent", () => {
    const state = { lastSuccessAt: hoursAgo(24), lastDeepAt: daysAgo(2) };
    expect(planHandleScrape(state, NOW, HANDLE_FRESH_WINDOW_CRON_MS)).toBe(
      "shallow"
    );
  });

  it("scrapes deep when the weekly deep pass is due", () => {
    const state = { lastSuccessAt: hoursAgo(24), lastDeepAt: daysAgo(7) };
    expect(planHandleScrape(state, NOW, HANDLE_FRESH_WINDOW_CRON_MS)).toBe(
      "deep"
    );
  });

  it("scrapes deep when the handle has succeeded but never deeply", () => {
    const state = { lastSuccessAt: hoursAgo(24), lastDeepAt: null };
    expect(planHandleScrape(state, NOW, HANDLE_FRESH_WINDOW_CRON_MS)).toBe(
      "deep"
    );
  });

  it("retries a failing handle at full cadence (no lastSuccessAt)", () => {
    const state = { lastSuccessAt: null, lastDeepAt: daysAgo(2) };
    expect(planHandleScrape(state, NOW, HANDLE_FRESH_WINDOW_CRON_MS)).toBe(
      "shallow"
    );
  });

  it("nightly cron cadence (24h) is never inside the cron freshness window", () => {
    expect(HANDLE_FRESH_WINDOW_CRON_MS).toBeLessThan(24 * 3_600_000);
    const state = { lastSuccessAt: hoursAgo(24), lastDeepAt: hoursAgo(24) };
    expect(
      planHandleScrape(state, NOW, HANDLE_FRESH_WINDOW_CRON_MS)
    ).not.toBe("skip");
  });

  it("deep interval tolerates daily-cron drift (under 7 days)", () => {
    expect(DEEP_SCRAPE_INTERVAL_MS).toBeLessThan(7 * 86_400_000);
  });

  it("manual window absorbs a double-click but not an hour-old sync", () => {
    const fresh = { lastSuccessAt: hoursAgo(0.1), lastDeepAt: daysAgo(1) };
    const stale = { lastSuccessAt: hoursAgo(1), lastDeepAt: daysAgo(1) };
    expect(planHandleScrape(fresh, NOW, HANDLE_FRESH_WINDOW_MANUAL_MS)).toBe(
      "skip"
    );
    expect(
      planHandleScrape(stale, NOW, HANDLE_FRESH_WINDOW_MANUAL_MS)
    ).toBe("shallow");
  });
});

describe("deactivated-creator weekly cadence", () => {
  it("window is under 7 days so the weekly pull cannot drift", async () => {
    const { DEACTIVATED_FRESH_WINDOW_MS } = await import(
      "@/lib/social/scrape-plan"
    );
    expect(DEACTIVATED_FRESH_WINDOW_MS).toBeLessThan(7 * 86_400_000);
    expect(DEACTIVATED_FRESH_WINDOW_MS).toBeGreaterThan(
      HANDLE_FRESH_WINDOW_CRON_MS
    );
  });

  it("skips inside the window, runs after it", async () => {
    const { DEACTIVATED_FRESH_WINDOW_MS } = await import(
      "@/lib/social/scrape-plan"
    );
    const recent = { lastSuccessAt: daysAgo(3), lastDeepAt: daysAgo(3) };
    const due = { lastSuccessAt: daysAgo(6.5), lastDeepAt: daysAgo(6.5) };
    expect(
      planHandleScrape(recent, NOW, DEACTIVATED_FRESH_WINDOW_MS)
    ).toBe("skip");
    expect(
      planHandleScrape(due, NOW, DEACTIVATED_FRESH_WINDOW_MS)
    ).not.toBe("skip");
  });
});

describe("pre-campaign tracking cutoff", () => {
  it("is 6 months before campaign start", async () => {
    const { trackingCutoff, PRE_CAMPAIGN_TRACKING_MONTHS } = await import(
      "@/lib/social/scrape-plan"
    );
    expect(PRE_CAMPAIGN_TRACKING_MONTHS).toBe(6);
    const cutoff = trackingCutoff(new Date(Date.UTC(2026, 6, 11)));
    expect(cutoff.getTime()).toBe(Date.UTC(2026, 0, 11));
  });

  it("handles year wrap", async () => {
    const { trackingCutoff } = await import("@/lib/social/scrape-plan");
    const cutoff = trackingCutoff(new Date(Date.UTC(2026, 1, 1)));
    expect(cutoff.getTime()).toBe(Date.UTC(2025, 7, 1));
  });
});

describe("dormant handles", () => {
  it("14+ days without a new post is dormant; newer is not", async () => {
    const { isDormantHandle, DORMANT_AFTER_MS } = await import(
      "@/lib/social/scrape-plan"
    );
    expect(DORMANT_AFTER_MS).toBe(14 * 86_400_000);
    expect(isDormantHandle(daysAgo(15), true, NOW)).toBe(true);
    expect(isDormantHandle(daysAgo(3), true, NOW)).toBe(false);
  });

  it("no posts ever: dormant only once the handle has been scraped", async () => {
    const { isDormantHandle } = await import("@/lib/social/scrape-plan");
    expect(isDormantHandle(null, true, NOW)).toBe(true);
    expect(isDormantHandle(null, false, NOW)).toBe(false);
  });

  it("dormant window is ~3 days and above the cron window", async () => {
    const { DORMANT_FRESH_WINDOW_MS } = await import(
      "@/lib/social/scrape-plan"
    );
    expect(DORMANT_FRESH_WINDOW_MS).toBeGreaterThan(
      HANDLE_FRESH_WINDOW_CRON_MS
    );
    expect(DORMANT_FRESH_WINDOW_MS).toBeLessThan(3 * 86_400_000);
  });
});

describe("budget modes", () => {
  it("critical at 90%+ regardless of pace", async () => {
    const { budgetModeFor } = await import("@/lib/social/scrape-plan");
    expect(budgetModeFor(0.9, 0.99)).toBe("critical");
    expect(budgetModeFor(0.95, 0.5)).toBe("critical");
  });

  it("conserve when spending runs ahead of the cycle's pace", async () => {
    const { budgetModeFor } = await import("@/lib/social/scrape-plan");
    expect(budgetModeFor(0.5, 0.2)).toBe("conserve");
    expect(budgetModeFor(0.4, 0.35)).toBe("normal");
  });

  it("normal when on or under pace", async () => {
    const { budgetModeFor } = await import("@/lib/social/scrape-plan");
    expect(budgetModeFor(0.3, 0.5)).toBe("normal");
    expect(budgetModeFor(0, 0)).toBe("normal");
  });
});
