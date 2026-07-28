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
