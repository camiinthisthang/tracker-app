import { DollarSign } from "lucide-react";
import type { CampaignBonusSummary } from "@/lib/view-bonus";

function usd(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function compact(n: number) {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Creator-facing: what view bonuses each campaign pays, and progress so far
 * this month. Each post earns the highest tier its views reach. */
export function CreatorBonusPotential({
  summaries,
  tiersByCampaign,
}: {
  summaries: CampaignBonusSummary[];
  tiersByCampaign: Record<
    string,
    { viewThreshold: number; amountUsd: number }[]
  >;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-1.5">
        <DollarSign className="h-4 w-4 text-emerald-500" />
        <h3 className="text-sm font-semibold text-slate-800">
          Your bonus potential
        </h3>
      </div>
      <p className="text-xs text-slate-400">
        Each post earns the highest tier its view count reaches — per campaign,
        this calendar month
      </p>

      <div className="mt-4 space-y-5">
        {summaries.map((c) => {
          const tiers = tiersByCampaign[c.campaignId] ?? [];
          const capPct =
            c.capUsd && c.capUsd > 0
              ? Math.min(100, (c.payableUsd / c.capUsd) * 100)
              : null;
          return (
            <div key={c.campaignId}>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {c.campaignName}
                </p>
                <p className="text-sm font-semibold text-emerald-600">
                  {usd(c.payableUsd)} earned
                  {c.capUsd !== null && (
                    <span className="text-xs font-normal text-slate-400">
                      {" "}
                      / {usd(c.capUsd)} monthly cap
                    </span>
                  )}
                </p>
              </div>
              {capPct !== null && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      capPct >= 100 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${capPct}%` }}
                  />
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tiers.map((t) => (
                  <span
                    key={t.viewThreshold}
                    className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                  >
                    {compact(t.viewThreshold)}+ views →{" "}
                    <span className="text-emerald-600">{usd(t.amountUsd)}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
