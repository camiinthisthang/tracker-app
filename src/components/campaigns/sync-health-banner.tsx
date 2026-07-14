import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export interface SyncSummary {
  at?: string;
  postsUpserted?: number;
  platformAttempts?: number;
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

  const creditIssue = failures.some((f) =>
    /credit|limit|quota|402/i.test(f.reason)
  );

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
