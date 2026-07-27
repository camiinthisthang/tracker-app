import {
  FLAG_LABELS,
  flagTooltip,
  type CreatorFlag,
  type PacingThresholds,
} from "@/lib/pacing";

const FLAG_STYLES: Record<CreatorFlag, string> = {
  off_pace: "bg-red-50 text-red-600",
  quiet: "bg-amber-50 text-amber-700",
  new: "bg-blue-50 text-blue-600",
  shadowbanned: "bg-violet-50 text-violet-600",
};

export function CreatorMonthlyProgress({
  postsThisMonth,
  monthlyGoal,
  flags,
  scopeLabel,
  periodLabel,
  thresholds,
  title = "Monthly goal",
  expected,
  note,
  platformSummary,
}: {
  postsThisMonth: number;
  monthlyGoal: number;
  flags: CreatorFlag[];
  scopeLabel: string;
  periodLabel: string;
  thresholds: PacingThresholds;
  /** "Campaign goal" for contract-based pacing; defaults to the monthly view. */
  title?: string;
  /** Cumulative expected-by-today count (contract pacing), shown under the bar. */
  expected?: number;
  /** e.g. warm-up week or not-started explanation. */
  note?: string | null;
  /** Per-platform delivered counts, e.g. "TikTok 38 · Instagram 36 ·
   * YouTube 31" — the goal number counts unique videos, this line shows
   * cross-post coverage (a lagging platform = missing cross-posts). */
  platformSummary?: string | null;
}) {
  const pct =
    monthlyGoal > 0 ? Math.min(100, (postsThisMonth / monthlyGoal) * 100) : 0;
  const shadowbanned = flags.includes("shadowbanned");
  const barColor = shadowbanned
    ? "bg-slate-300"
    : flags.includes("off_pace")
      ? "bg-red-500"
      : "bg-emerald-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            {title} · {periodLabel}
          </h3>
          <p className="text-xs text-slate-400">
            Cumulative pacing · {scopeLabel} · flags at &lt;
            {thresholds.offPacePct}% of pace or {thresholds.quietDays}+ quiet
            days (set per campaign)
          </p>
        </div>
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {flags.map((f) => (
              <span
                key={f}
                title={flagTooltip(f, thresholds)}
                className={`cursor-help rounded-full px-2 py-0.5 text-[10px] font-medium ${FLAG_STYLES[f]}`}
              >
                {FLAG_LABELS[f]}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <p className="text-2xl font-bold text-slate-800">
          {postsThisMonth}
          <span className="text-sm font-medium text-slate-400">
            {" "}
            / {monthlyGoal || "—"} posts
          </span>
        </p>
        {monthlyGoal > 0 && (
          <span className="text-xs font-medium text-slate-500">
            {Math.round(pct)}%
          </span>
        )}
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {expected !== undefined && expected > 0 && (
        <p className="mt-1.5 text-xs text-slate-400">
          Expected ~{Math.round(expected)} by today to stay on pace
        </p>
      )}
      {platformSummary && (
        <p className="mt-1.5 text-xs text-slate-400">
          Unique videos · cross-posted: {platformSummary}
        </p>
      )}
      {note && <p className="mt-1.5 text-xs text-blue-500">{note}</p>}
      {shadowbanned && (
        <p className="mt-1.5 text-xs text-violet-500">
          Shadow-banned — excluded from pacing so the ban isn&apos;t read as
          falling behind.
        </p>
      )}
    </div>
  );
}
