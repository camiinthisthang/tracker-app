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

/** Deactivated creators/memberships still track (per Jackie 2026-07-28: a
 * deactivated creator's viral video keeps counting) but on a WEEKLY cadence
 * instead of nightly — they're off the roster, so day-to-day freshness isn't
 * worth the actor spend. 6 days, not 7, so the weekly pull can't drift. When
 * they do run, the scrape is full-depth. */
export const DEACTIVATED_FRESH_WINDOW_MS = 6 * 86_400_000;

/** Posts published more than this many months before their campaign's start
 * date are out of tracking scope (per Jackie, 2026-07-29: "don't track
 * anything that is not within 4–6 months of the campaign" — we use the
 * generous end so recent pre-campaign viral posts still count, while a
 * handle's ancient history — e.g. techwithkam's Feb-2023 posts — doesn't
 * inflate campaign totals). */
export const PRE_CAMPAIGN_TRACKING_MONTHS = 6;

/** Earliest postedAt that still counts for a campaign starting at `campaignStart`. */
export function trackingCutoff(campaignStart: Date): Date {
  const d = new Date(campaignStart);
  d.setMonth(d.getMonth() - PRE_CAMPAIGN_TRACKING_MONTHS);
  return d;
}

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
