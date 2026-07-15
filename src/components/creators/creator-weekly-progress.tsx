import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatorWeeklyProgressProps {
  postsThisWeek: number;
  weeklyTarget: number;
  postsPerDay: { day: string; count: number }[];
  dailyTarget: number;
  /**
   * When provided, the header becomes a link to a historical-weeks view at
   * this href. Omitted on the historical page itself so we don't link to
   * ourselves.
   */
  historyHref?: string;
  /** e.g. "Mon Jul 7 – Sun Jul 13" — which week the goal covers. */
  weekLabel?: string;
  /** Arrow links to step through past weeks. newerHref null = viewing the
   * current week (no forward arrow). */
  nav?: { olderHref: string; newerHref: string | null };
}

function ProgressRing({ count, target }: { count: number; target: number }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(count / target, 1) : 0;
  const offset = circumference - pct * circumference;

  const hit = count >= target && target > 0;
  const partial = count > 0 && count < target;

  return (
    <div className="relative h-12 w-12">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={count > 0 ? "#dbeafe" : "#f1f5f9"}
          strokeWidth="3"
        />
        {pct > 0 && (
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "text-base font-semibold",
            hit
              ? "text-blue-600"
              : partial
              ? "text-blue-500"
              : "text-slate-400"
          )}
        >
          {count}
        </span>
      </div>
    </div>
  );
}

export function CreatorWeeklyProgress({
  postsThisWeek,
  weeklyTarget,
  postsPerDay,
  dailyTarget,
  historyHref,
  weekLabel,
  nav,
}: CreatorWeeklyProgressProps) {
  const pct =
    weeklyTarget > 0 ? Math.min((postsThisWeek / weeklyTarget) * 100, 100) : 0;
  const onTrack = postsThisWeek >= weeklyTarget;
  const isCurrentWeek = !nav || nav.newerHref === null;

  const titleBlock = (
    <div className="flex items-center gap-1.5">
      <h3 className="text-sm font-semibold text-slate-800">
        {isCurrentWeek ? "This week's goal" : "Week in review"}
      </h3>
      {historyHref && (
        <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
      )}
      {nav && (
        <span className="ml-1 flex items-center gap-0.5">
          <Link
            href={nav.olderHref}
            aria-label="Previous week"
            className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {nav.newerHref ? (
            <Link
              href={nav.newerHref}
              aria-label="Next week"
              className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="rounded-md p-0.5 text-slate-200">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </span>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          {historyHref ? (
            <Link href={historyHref} className="group block">
              {titleBlock}
              <p className="text-xs text-slate-400">
                {weekLabel ? `${weekLabel} · ` : ""}View past weeks
              </p>
            </Link>
          ) : (
            <>
              {titleBlock}
              <p className="text-xs text-slate-400">
                {weekLabel ?? "Posts you've submitted this week"}
              </p>
            </>
          )}
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-2xl font-bold",
              onTrack ? "text-emerald-600" : "text-slate-800"
            )}
          >
            {postsThisWeek}
            <span className="text-base font-normal text-slate-400">
              /{weeklyTarget}
            </span>
          </p>
          <p className="text-[10px] text-slate-400">
            {onTrack ? "🎉 Goal hit!" : `${weeklyTarget - postsThisWeek} to go`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            onTrack ? "bg-emerald-500" : "bg-blue-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Day rings */}
      <div className="mt-6 flex items-start justify-between">
        {postsPerDay.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <ProgressRing count={d.count} target={dailyTarget} />
            <span className="text-[10px] font-medium uppercase text-slate-400">
              {d.day}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
