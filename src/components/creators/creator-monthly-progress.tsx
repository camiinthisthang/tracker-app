import { FLAG_LABELS, type CreatorFlag } from "@/lib/pacing";

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
}: {
  postsThisMonth: number;
  monthlyGoal: number;
  flags: CreatorFlag[];
  scopeLabel: string;
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
            Monthly goal
          </h3>
          <p className="text-xs text-slate-400">
            Cumulative this calendar month · {scopeLabel}
          </p>
        </div>
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {flags.map((f) => (
              <span
                key={f}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${FLAG_STYLES[f]}`}
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
      {shadowbanned && (
        <p className="mt-1.5 text-xs text-violet-500">
          Shadow-banned — excluded from pacing so the ban isn&apos;t read as
          falling behind.
        </p>
      )}
    </div>
  );
}
