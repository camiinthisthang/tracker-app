/**
 * Apify burn control: decide how (and whether) to scrape each handle.
 *
 * The Jul 22 outage was the account's MONTHLY usage hard limit — every handle
 * scraped at full depth every night (plus manual re-syncs re-scraping the
 * same handles) burned the budget mid-cycle. Two levers cut the burn without
 * making the dashboard stale:
 *
 * - Depth: new posts always appear at the top of a profile, so a cheap
 *   15-result "shallow" scrape catches every new post and the metric movement
 *   that matters day-to-day (actors bill per result). A full-depth "deep"
 *   pass (60 results) runs roughly weekly per handle to refresh older posts'
 *   view counts. Weekly cost ≈ (6×15 + 60) / (7×60) ≈ one third of scraping
 *   everything deep nightly.
 *
 * - Freshness skip: a handle successfully scraped within the window isn't
 *   scraped again. This dedupes handles shared across campaigns inside one
 *   cron run and absorbs back-to-back manual re-syncs. Failures never update
 *   lastSuccessAt, so anything that errored is retried at full cadence.
 */

export type ScrapeDepth = "deep" | "shallow";
export type ScrapePlan = ScrapeDepth | "skip";

/** A handle gets a deep pass when its last one is at least this old. 6.5 days
 * instead of 7 so the nightly cron (24h cadence) can't drift into 8-day
 * deep-pass gaps. */
export const DEEP_SCRAPE_INTERVAL_MS = 6.5 * 86_400_000;

/** Cron freshness window. Well under the 24h cron cadence — every handle
 * still scrapes every night — but wide enough to dedupe a handle appearing in
 * several campaigns in the same run, or a manually re-fired cron. */
export const HANDLE_FRESH_WINDOW_CRON_MS = 6 * 3_600_000;

/** Manual "Sync Data" freshness window. Short — the click is an explicit ask
 * for fresh numbers — but nonzero so syncing two campaigns that share
 * handles back-to-back doesn't scrape the shared ones twice. */
export const HANDLE_FRESH_WINDOW_MANUAL_MS = 30 * 60_000;

export type HandleScrapeState = {
  lastSuccessAt: Date | null;
  lastDeepAt: Date | null;
};

export function planHandleScrape(
  state: HandleScrapeState | undefined,
  now: number,
  freshWindowMs: number
): ScrapePlan {
  if (
    freshWindowMs > 0 &&
    state?.lastSuccessAt &&
    now - state.lastSuccessAt.getTime() < freshWindowMs
  ) {
    return "skip";
  }
  if (
    !state?.lastDeepAt ||
    now - state.lastDeepAt.getTime() >= DEEP_SCRAPE_INTERVAL_MS
  ) {
    return "deep";
  }
  return "shallow";
}
