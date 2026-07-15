import Link from "next/link";
import { cn } from "@/lib/utils";

export interface CreatorProgress {
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  /** False = deactivated on the campaign: unmanaged, still syncing. */
  isActive: boolean;
  videosPerDay: number;
  weeklyTarget: number;
  postsThisWeek: number;
  postsPerDay: { day: string; count: number }[];
}

function ProgressRing({ count, target }: { count: number; target: number }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(count / target, 1) : 0;
  const offset = circumference - pct * circumference;

  const hit = count >= target && target > 0;
  const partial = count > 0 && count < target;

  return (
    <div className="relative h-10 w-10">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={count > 0 ? "#fde7e7" : "#f1f5f9"}
          strokeWidth="2.5"
        />
        {pct > 0 && (
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="#ee2324"
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "text-sm font-semibold",
            hit
              ? "text-[color:var(--brand-blue)]"
              : partial
              ? "text-[color:var(--brand-blue)]"
              : "text-slate-400"
          )}
        >
          {count}
        </span>
      </div>
    </div>
  );
}

export function CreatorProgressCard({
  progress,
}: {
  progress: CreatorProgress;
}) {
  const onTrack = progress.postsThisWeek >= progress.weeklyTarget;

  return (
    <Link
      href={`/creators/${progress.creatorId}`}
      className={cn(
        "block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300",
        !progress.isActive && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-800">
              @{progress.creatorHandle}
            </span>
            {!progress.isActive && (
              <span
                title="Deactivated on this campaign — not managed, no posts expected, but their accounts still sync"
                className="shrink-0 cursor-help rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
              >
                Deactivated
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-400">
            {progress.creatorName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-sm font-semibold",
              onTrack ? "text-emerald-600" : "text-slate-800"
            )}
          >
            {progress.postsThisWeek}/{progress.weeklyTarget}{" "}
            <span className="font-normal text-slate-500">posts</span>
          </p>
          <p className="text-[10px] text-slate-400">
            {progress.weeklyTarget} posts/week target
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between">
        {progress.postsPerDay.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <ProgressRing count={d.count} target={progress.videosPerDay} />
            <span className="text-[10px] font-medium uppercase text-slate-400">
              {d.day}
            </span>
          </div>
        ))}
      </div>
    </Link>
  );
}

interface CreatorProgressSectionProps {
  progresses: CreatorProgress[];
  campaignId: string;
  previewOnly?: boolean;
  /** Overrides the default "Posts submitted this week vs. weekly target". */
  subtitle?: string;
  /**
   * Overrides the "See all posts" link in the header's right slot. Useful for
   * the full-screen progress page where we render a week-picker instead.
   */
  headerRight?: React.ReactNode;
}

export function CreatorProgressSection({
  progresses,
  campaignId,
  previewOnly = true,
  subtitle,
  headerRight,
}: CreatorProgressSectionProps) {
  if (progresses.length === 0) return null;

  // Cut creators sort to the bottom (and, in preview mode, yield their slots to
  // active creators) — they're kept for history, not current expectation.
  const ordered = [...progresses].sort(
    (a, b) => Number(b.isActive) - Number(a.isActive)
  );
  const displayed = previewOnly ? ordered.slice(0, 3) : ordered;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Creator Progress
          </h3>
          <p className="text-xs text-slate-400">
            {subtitle ?? "Posts submitted this week vs. weekly target"}
          </p>
        </div>
        {headerRight ??
          (previewOnly && progresses.length > 3 ? (
            <Link
              href={`/campaigns/${campaignId}/progress`}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              See all posts
            </Link>
          ) : null)}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map((p) => (
          <CreatorProgressCard key={p.creatorId} progress={p} />
        ))}
      </div>
    </div>
  );
}
