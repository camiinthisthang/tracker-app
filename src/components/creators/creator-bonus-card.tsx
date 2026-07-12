import { DollarSign, ExternalLink } from "lucide-react";
import type { CampaignBonusSummary } from "@/lib/view-bonus";

function usd(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function CreatorBonusCard({
  summaries,
}: {
  summaries: CampaignBonusSummary[];
}) {
  const totalPayable = summaries.reduce((s, c) => s + c.payableUsd, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-1.5">
        <DollarSign className="h-4 w-4 text-emerald-500" />
        <h3 className="text-sm font-semibold text-slate-800">
          Bonuses earned this month
        </h3>
      </div>
      <p className="text-xs text-slate-400">
        View-tier bonuses — each post earns the highest tier its views reach
      </p>

      <p className="mt-3 text-2xl font-bold text-slate-800">
        {usd(totalPayable)}
      </p>

      <div className="mt-3 space-y-4">
        {summaries.map((c) => {
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
                <p className="text-sm font-semibold text-slate-800">
                  {usd(c.payableUsd)}
                  {c.capUsd !== null && (
                    <span className="text-xs font-normal text-slate-400">
                      {" "}
                      / {usd(c.capUsd)} cap
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
              {c.earnedUsd > c.payableUsd && (
                <p className="mt-0.5 text-[10px] text-amber-600">
                  Monthly cap reached — {usd(c.earnedUsd)} earned before cap
                </p>
              )}
              {c.posts.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {c.posts.slice(0, 5).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-slate-500">
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:text-blue-600"
                        >
                          {p.title || "(untitled post)"}
                        </a>
                        <ExternalLink className="h-3 w-3 shrink-0 text-slate-300" />
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {compact(p.views)} views · {compact(p.tierThreshold)}+
                        tier ·{" "}
                        <span className="font-medium text-emerald-600">
                          {usd(p.amountUsd)}
                        </span>
                      </span>
                    </li>
                  ))}
                  {c.posts.length > 5 && (
                    <li className="text-[10px] text-slate-400">
                      +{c.posts.length - 5} more qualifying post
                      {c.posts.length - 5 === 1 ? "" : "s"}
                    </li>
                  )}
                </ul>
              )}
              {c.posts.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  No posts have reached a bonus tier yet this month
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
