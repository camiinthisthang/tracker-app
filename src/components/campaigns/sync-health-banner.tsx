import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export interface SyncSummary {
  at?: string;
  postsUpserted?: number;
  platformAttempts?: number;
  monthlyLimitHit?: boolean;
  failures?: { creator: string; reason: string }[];
}

/**
 * Amber banner shown when the campaign's most recent sync had failures —
 * before this, an Apify credit cap or blocked scrape just read as "views
 * stuck at zero" with no explanation anywhere in the UI.
 */
export function SyncHealthBanner({ summary }: { summary: SyncSummary | null }) {
  const failures = summary?.failures ?? [];
  if (!summary || failures.length === 0) return null;

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
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 print:hidden">
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
        </div>
      </div>
    </div>
  );
}
