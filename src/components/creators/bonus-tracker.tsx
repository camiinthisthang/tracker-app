import { Sparkles, CheckCircle2 } from "lucide-react";
import type { BonusSummary } from "@/lib/bonus";

function formatTriggerCopy(
  trigger: "VIEW_THRESHOLD" | "VIRAL_COUNT",
  threshold: number
) {
  if (trigger === "VIEW_THRESHOLD") {
    return `Land a post with ${threshold.toLocaleString()}+ views`;
  }
  return `Hit ${threshold} viral videos this month`;
}

export function BonusTracker({ summary }: { summary: BonusSummary }) {
  if (summary.rules.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Bonus tracker
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            ${summary.earnedUsd.toLocaleString()} earned this month
          </p>
          <p className="text-xs text-slate-500">
            Out of ${summary.totalPossibleUsd.toLocaleString()} possible across{" "}
            {summary.rules.length} bonus{" "}
            {summary.rules.length === 1 ? "rule" : "rules"}.
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
          <Sparkles className="h-5 w-5 text-emerald-600" />
        </div>
      </div>

      {summary.nextMilestone && (
        <div className="mt-4 rounded-xl bg-blue-50/60 p-4">
          <p className="text-xs font-medium text-blue-700">
            Next milestone: {summary.nextMilestone.label}
          </p>
          <p className="mt-1 text-sm text-slate-800">
            {formatTriggerCopy(
              summary.nextMilestone.trigger,
              summary.nextMilestone.threshold
            )}{" "}
            for{" "}
            <span className="font-semibold text-emerald-600">
              +${summary.nextMilestone.amountUsd.toLocaleString()}
            </span>
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{
                width: `${Math.round(summary.nextMilestone.progress * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {summary.nextMilestone.current.toLocaleString()} /{" "}
            {summary.nextMilestone.threshold.toLocaleString()}
          </p>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {summary.rules.map((r) => (
          <div
            key={r.ruleId}
            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-800">
                {r.label}
                {r.isEarned && (
                  <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-emerald-500" />
                )}
              </p>
              <p className="text-[11px] text-slate-500">
                {formatTriggerCopy(r.trigger, r.threshold)}
              </p>
            </div>
            <div className="ml-3 text-right text-sm">
              <p className="font-semibold text-emerald-600">
                ${r.amountUsd.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">
                {r.current.toLocaleString()} / {r.threshold.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
