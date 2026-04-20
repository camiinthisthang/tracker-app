import { Sparkles } from "lucide-react";
import type { BonusSummary } from "@/lib/bonus";

const TRIGGER_UNIT: Record<
  "VIRAL_COUNT" | "REFERRAL_COUNT" | "USER_DOWNLOAD" | "USER_PAID_PLAN",
  string
> = {
  VIRAL_COUNT: "viral video",
  REFERRAL_COUNT: "referral",
  USER_DOWNLOAD: "signup",
  USER_PAID_PLAN: "paid signup",
};

function pluralize(n: number, word: string) {
  return n === 1 ? word : `${word}s`;
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
            Across {summary.rules.length} active{" "}
            {pluralize(summary.rules.length, "rule")}.
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
          <Sparkles className="h-5 w-5 text-emerald-600" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {summary.rules.map((r) => {
          const unit = TRIGGER_UNIT[r.trigger];
          return (
            <div
              key={r.ruleId}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">{r.label}</p>
                <p className="text-[11px] text-slate-500">
                  ${r.ratePerUnit.toLocaleString()} per {unit} ·{" "}
                  {r.current.toLocaleString()} {pluralize(r.current, unit)} this
                  month
                </p>
              </div>
              <div className="ml-3 text-right text-sm">
                <p className="font-semibold text-emerald-600">
                  ${r.earnedUsd.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
