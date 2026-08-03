import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { ApifyBudgetMode } from "@/lib/social/scrape-plan";

export interface SyncSummary {
  at?: string;
  postsUpserted?: number;
  platformAttempts?: number;
  monthlyLimitHit?: boolean;
  apifyBudget?: {
    mode: ApifyBudgetMode;
    usedUsd: number;
    limitUsd: number;
  } | null;
  failures?: { creator: string; reason: string }[];
}

function banner(tone: "amber" | "slate") {
  return `mb-4 rounded-xl border p-4 print:hidden ${
    tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-slate-50"
  }`;
}

/**
 * Amber banner shown when the campaign's most recent sync had failures —
 * before this, an Apify credit cap or blocked scrape just read as "views
 * stuck at zero" with no explanation anywhere in the UI.
 */
export function SyncHealthBanner({ summary }: { summary: SyncSummary | null }) {
  const all = summary?.failures ?? [];
  // Budget pacing note: shown whenever the last sync ran in a reduced mode —
  // even with zero failures — spending ahead of pace should be visible
  // BEFORE it becomes a wall of monthly-limit 403s.
  const budget = summary?.apifyBudget ?? null;
  const budgetNote =
    budget && budget.mode !== "normal" ? (
      <p
        className={`text-xs font-medium ${
          budget.mode === "critical" ? "text-amber-700" : "text-slate-500"
        }`}
      >
        Apify budget: ${budget.usedUsd.toLocaleString()} of $
        {budget.limitUsd.toLocaleString()} used this cycle —{" "}
        {budget.mode === "critical"
          ? "syncs are in essential-only mode (active handles, shallow) until the cycle resets or the limit is raised."
          : "spending is ahead of pace, so deep refreshes and dormant handles are paused to stretch the budget."}
      </p>
    ) : null;

  if (!summary || all.length === 0) {
    if (!budgetNote) return null;
    return (
      <div className={banner(budget?.mode === "critical" ? "amber" : "slate")}>
        {budgetNote}
      </div>
    );
  }

  // Time-budget deferrals are routine, not failures: the scrape is abandoned
  // before Vercel's kill wall and automatically goes first on the next run.
  // Splitting them out keeps the amber banner for things that actually need
  // attention — a lone deferral used to read as "failed fetch" and made
  // healthy data look broken.
  const deferred = all.filter((f) => /time budget/i.test(f.reason));
  const failures = all.filter((f) => !/time budget/i.test(f.reason));

  if (failures.length === 0) {
    return (
      <div className={banner("slate")}>
        <p className="text-sm text-slate-600">
          Last sync ran out of time before finishing {deferred.length} scrape
          {deferred.length === 1 ? "" : "s"}
          {summary.at
            ? ` (${format(new Date(summary.at), "MMM d, h:mm a")})`
            : ""}{" "}
          — they run first on the next sync. No action needed.
        </p>
        {budgetNote && <div className="mt-1.5">{budgetNote}</div>}
      </div>
    );
  }

  // Monthly-usage 403s mean the Apify account's budget for the billing cycle
  // is spent — nothing syncs until it resets or the limit is raised.
  const monthlyLimit =
    summary.monthlyLimitHit ||
    failures.some((f) => /monthly usage hard limit/i.test(f.reason));
  // Memory-cap 402s ("memory limit ... for all your Actor runs") are a
  // concurrency problem, not billing — check them first so they don't
  // trigger the buy-credits hint.
  const memoryIssue =
    !monthlyLimit && failures.some((f) => /memory limit/i.test(f.reason));
  const creditIssue =
    !monthlyLimit &&
    !memoryIssue &&
    failures.some((f) => /credit|quota|payment|402/i.test(f.reason));

  return (
    <div className={banner("amber")}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            Last sync had {failures.length} failed fetch
            {failures.length === 1 ? "" : "es"}
            {summary.at
              ? ` (${format(new Date(summary.at), "MMM d, h:mm a")})`
              : ""}{" "}
            — some views may be stale or missing
          </p>
          {monthlyLimit && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              The Apify account has hit its monthly usage hard limit — no
              scrape can run until the billing cycle resets or the limit is
              raised at console.apify.com → Billing. Re-syncing doesn&apos;t
              use extra credits, but it can&apos;t fetch anything until then.
            </p>
          )}
          {memoryIssue && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Too many scrapes ran at once and Apify&apos;s concurrent-memory
              cap rejected the rest — not a credits problem. The sync now
              throttles itself; hit Sync Data again to fill in the skipped
              handles.
            </p>
          )}
          {creditIssue && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Looks like the Apify account is out of credits — ask Cami to top
              it up, then re-sync.
            </p>
          )}
          <ul className="mt-1.5 space-y-0.5">
            {failures.slice(0, 6).map((f, i) => (
              <li key={i} className="truncate text-xs text-amber-700">
                @{f.creator}: {f.reason}
              </li>
            ))}
            {failures.length > 6 && (
              <li className="text-xs text-amber-600">
                …and {failures.length - 6} more
              </li>
            )}
          </ul>
          {deferred.length > 0 && (
            <p className="mt-1.5 text-xs text-amber-600/80">
              Plus {deferred.length} scrape{deferred.length === 1 ? "" : "s"}{" "}
              deferred to the next run (time budget — not a failure).
            </p>
          )}
          {budgetNote && <div className="mt-1.5">{budgetNote}</div>}
        </div>
      </div>
    </div>
  );
}
