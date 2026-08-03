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

/** A handle is DORMANT when its newest tracked post is at least this old (or
 * it has been scraped successfully before and never had a post). Dormant
 * handles get the slower cadence below instead of nightly — enough to catch
 * a dormant video that suddenly goes viral within a couple of days, without
 * paying for a nightly scrape that returns nothing new. */
export const DORMANT_AFTER_MS = 14 * 86_400_000;

/** Dormant-handle freshness window: ~every 3rd nightly run (2.5 days so the
 * cadence can't drift past 3 days). The weekly deep pass still applies. */
export const DORMANT_FRESH_WINDOW_MS = 2.5 * 86_400_000;

export function isDormantHandle(
  latestPostAt: Date | null,
  everScraped: boolean,
  now: number
): boolean {
  if (latestPostAt == null) return everScraped;
  return now - latestPostAt.getTime() >= DORMANT_AFTER_MS;
}

/**
 * Budget-aware sync modes, from the Apify account's live monthly usage:
 * - normal:   under pace — full behavior.
 * - conserve: spending ahead of the billing cycle's pace — repeat deep
 *   passes downgrade to shallow (first-ever deeps still allowed) and
 *   dormant handles sit out the run.
 * - critical: >=90% of the monthly limit used — active handles only, all
 *   shallow; dormant and deactivated handles sit out.
 */
export type ApifyBudgetMode = "normal" | "conserve" | "critical";

/** How far ahead of the cycle's elapsed-time pace spending may run before
 * conserve mode kicks in (15 percentage points of the monthly budget). */
export const BUDGET_PACE_SLACK = 0.15;

export function budgetModeFor(
  usedRatio: number,
  cycleElapsedRatio: number
): ApifyBudgetMode {
  if (usedRatio >= 0.9) return "critical";
  if (usedRatio > cycleElapsedRatio + BUDGET_PACE_SLACK) return "conserve";
  return "normal";
}

/** Which scheduling tier a handle is on: active roster (nightly), dormant
 * (~3-day checks), or weekly (deactivated creators/memberships). */
export type CadenceTier = "active" | "dormant" | "weekly";

export type ScrapeDecision =
  | { action: "run"; depth: ScrapeDepth }
  | { action: "skip"; reason: "fresh" | "budget" };

const TIER_FLOOR_WINDOW_MS: Record<CadenceTier, number> = {
  active: 0,
  dormant: DORMANT_FRESH_WINDOW_MS,
  weekly: DEACTIVATED_FRESH_WINDOW_MS,
};

/**
 * The whole per-handle scheduling decision in one place: cadence tier +
 * budget mode + freshness/deep-pass state → run (at what depth) or skip
 * (why). Both sync entry points route through this, so budget guardrails
 * can't be bypassed by one code path drifting.
 *
 * Budget policy: dormant handles sit out any non-normal mode; weekly handles
 * sit out critical; conserve downgrades REPEAT deep passes to shallow for
 * active handles (a first-ever deep backfill still runs); critical forces
 * shallow. Weekly handles keep their deep pass in conserve — they're only
 * touched once a week as it is.
 */
export function planScrape(opts: {
  state: HandleScrapeState | undefined;
  tier: CadenceTier;
  budgetMode: ApifyBudgetMode | null;
  callerFreshWindowMs: number;
  now: number;
}): ScrapeDecision {
  const { state, tier, budgetMode, callerFreshWindowMs, now } = opts;

  if (budgetMode && budgetMode !== "normal") {
    if (tier === "dormant" || (tier === "weekly" && budgetMode === "critical")) {
      return { action: "skip", reason: "budget" };
    }
  }

  const window = Math.max(callerFreshWindowMs, TIER_FLOOR_WINDOW_MS[tier]);
  const plan = planHandleScrape(state, now, window);
  if (plan === "skip") return { action: "skip", reason: "fresh" };

  let depth: ScrapeDepth = tier === "weekly" ? "deep" : plan;
  if (budgetMode === "critical") {
    depth = "shallow";
  } else if (
    budgetMode === "conserve" &&
    tier !== "weekly" &&
    depth === "deep" &&
    state?.lastDeepAt
  ) {
    depth = "shallow";
  }
  return { action: "run", depth };
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
