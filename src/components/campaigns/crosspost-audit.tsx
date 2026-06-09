import Link from "next/link";
import { format } from "date-fns";
import { Check, AlertTriangle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CrosspostAuditGap {
  /** ISO date of the post that wasn't crossposted. */
  postedAt: string;
  /**
   * Platform the post was on; we're flagging the missing OTHER side. The full
   * `Platform` enum has TIKTOK/INSTAGRAM/YOUTUBE/FACEBOOK, but in practice the
   * crosspost audit only ever runs against IG ↔ TikTok pairs.
   */
  sourcePlatform: string;
  /** Link to the original (the one that DOES exist). */
  link: string;
}

export interface CrosspostAuditRow {
  creatorId: string;
  creatorHandle: string;
  creatorName: string;
  /** Total posts on the creator's goal platform within the window. */
  goalPlatformPosts: number;
  /** Number of those that have a same-creator match on the other platform within ±24h. */
  matched: number;
  /** Specific posts that don't have a crosspost match yet. */
  gaps: CrosspostAuditGap[];
}

interface Props {
  rows: CrosspostAuditRow[];
  /** Human label for the window, e.g. "this week", "May 25 – May 31". */
  rangeLabel: string;
}

export function CrosspostAudit({ rows, rangeLabel }: Props) {
  if (rows.length === 0) {
    return null;
  }

  // Classify each creator: needs-work (has gaps) and no-posts surface above the
  // fully-crossposted ones so the problems are visible first.
  const rank = (r: CrosspostAuditRow) =>
    r.goalPlatformPosts === 0 ? 1 : r.gaps.length > 0 ? 0 : 2;
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b));

  const needsWork = rows.filter(
    (r) => r.goalPlatformPosts > 0 && r.gaps.length > 0
  ).length;
  const noPosts = rows.filter((r) => r.goalPlatformPosts === 0).length;

  const summaryParts: string[] = [];
  if (needsWork > 0)
    summaryParts.push(`${needsWork} with gaps`);
  if (noPosts > 0)
    summaryParts.push(`${noPosts} didn't post`);
  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : "All goal-platform posts are crossposted ✓";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Crosspost audit
          </h3>
          <p className="text-xs text-slate-400">
            For each goal-platform post in {rangeLabel}, we look for a matching
            post by the same creator on the other platform within ±24h. {summary}
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {sorted.map((row) => {
          const noPosts = row.goalPlatformPosts === 0;
          const allMatched = !noPosts && row.gaps.length === 0;
          return (
            <div
              key={row.creatorId}
              className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/creators/${row.creatorId}`}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-blue-600"
                >
                  @{row.creatorHandle}
                  <span className="text-xs font-normal text-slate-400">
                    {row.creatorName}
                  </span>
                </Link>
                {row.gaps.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                    {row.gaps.slice(0, 3).map((g, i) => (
                      <li key={i}>
                        <a
                          href={g.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-slate-700 hover:underline"
                        >
                          {format(new Date(g.postedAt), "MMM d")} ·{" "}
                          {g.sourcePlatform === "INSTAGRAM" ? "IG post" : "TikTok post"}
                          {" "}with no{" "}
                          {g.sourcePlatform === "INSTAGRAM" ? "TikTok" : "Instagram"}
                          {" "}crosspost
                        </a>
                      </li>
                    ))}
                    {row.gaps.length > 3 && (
                      <li className="text-slate-400">
                        + {row.gaps.length - 3} more
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  noPosts
                    ? "bg-slate-100 text-slate-500"
                    : allMatched
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                )}
              >
                {noPosts ? (
                  <>
                    <Minus className="h-3.5 w-3.5" />
                    No posts
                  </>
                ) : (
                  <>
                    {allMatched ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {row.matched} / {row.goalPlatformPosts} crossposted
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
