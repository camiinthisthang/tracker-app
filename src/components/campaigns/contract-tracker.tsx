"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContractWeek {
  key: string; // ISO Monday, e.g. "2026-06-08"
  label: string; // "Week 1"
  range: string; // "Jun 8 – Jun 14, 2026" — shown on hover
  isCurrent: boolean;
}

export interface ContractCreatorRow {
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  /** False = cut from the campaign: kept for history, not expected to post. */
  isActive: boolean;
  contractedTiktok: number | null;
  contractedInstagram: number | null;
  postedTiktok: number;
  postedInstagram: number;
  /** Per-week posted counts keyed by ContractWeek.key. */
  weekly: Record<string, { tiktok: number; instagram: number }>;
}

type PlatformView = "all" | "tiktok" | "instagram";

const PLATFORM_TABS: { value: PlatformView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
];

const DEFAULT_AT_RISK = 75;

/** Posted/contracted/weekly numbers for the selected platform view. */
function valuesFor(row: ContractCreatorRow, view: PlatformView) {
  if (view === "tiktok") {
    return {
      contracted: row.contractedTiktok,
      posted: row.postedTiktok,
      week: (k: string) => row.weekly[k]?.tiktok ?? 0,
    };
  }
  if (view === "instagram") {
    return {
      contracted: row.contractedInstagram,
      posted: row.postedInstagram,
      week: (k: string) => row.weekly[k]?.instagram ?? 0,
    };
  }
  const tt = row.contractedTiktok;
  const ig = row.contractedInstagram;
  return {
    contracted: tt == null && ig == null ? null : (tt ?? 0) + (ig ?? 0),
    posted: row.postedTiktok + row.postedInstagram,
    week: (k: string) => {
      const w = row.weekly[k];
      return w ? w.tiktok + w.instagram : 0;
    },
  };
}

/**
 * Pace status: did the creator deliver enough of their contract for how far
 * the campaign has progressed? expected = contracted * fraction-of-time-elapsed.
 * `atRiskPct` is the floor (% of expected) below which they flip from At risk
 * to Behind.
 */
function paceStatus(
  contracted: number | null,
  posted: number,
  elapsedFraction: number,
  atRiskPct: number
): { label: string; cls: string } | null {
  if (!contracted || contracted <= 0) return null;
  if (posted >= contracted)
    return { label: "Complete", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  const expected = contracted * elapsedFraction;
  if (posted >= expected)
    return { label: "On track", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (posted >= expected * (atRiskPct / 100))
    return { label: "At risk", cls: "bg-amber-50 text-amber-700 ring-amber-200" };
  return { label: "Behind", cls: "bg-red-50 text-red-700 ring-red-200" };
}

function PaceBadge({ pace }: { pace: { label: string; cls: string } | null }) {
  if (!pace) return <span className="text-xs text-slate-300">—</span>;
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        pace.cls
      )}
    >
      {pace.label}
    </span>
  );
}

/** Single inline-editable contracted number bound to one platform field. */
function ContractInput({
  campaignId,
  creatorId,
  field,
  label,
  initial,
}: {
  campaignId: string;
  creatorId: string;
  field: "contractedTiktok" | "contractedInstagram";
  label: string;
  initial: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const next = value.trim();
    if (next === (initial?.toString() ?? "")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/creators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId, [field]: next === "" ? null : next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Save failed");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      setValue(initial?.toString() ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex items-center gap-1">
      <span className="text-[10px] font-medium uppercase text-slate-400">
        {label}
      </span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="—"
        className="w-12 rounded-md border border-slate-200 bg-white px-1 py-1 text-center text-sm tabular-nums text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 disabled:opacity-50"
      />
    </label>
  );
}

/** Info icon that reveals the pace-legend popover on hover/focus. */
function PaceLegend({ atRiskPct }: { atRiskPct: number }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="text-slate-300 hover:text-slate-500 focus:text-slate-500 focus:outline-none"
        aria-label="What the pace labels mean"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span className="pointer-events-none absolute right-0 top-5 z-20 hidden w-60 rounded-lg border border-slate-200 bg-white p-3 text-left text-[11px] font-normal normal-case text-slate-600 shadow-lg group-hover:block group-focus-within:block">
        <span className="mb-1.5 block font-semibold text-slate-700">
          How pace is scored
        </span>
        <span className="block leading-relaxed">
          Expected = contracted × % of the campaign window elapsed.
        </span>
        <span className="mt-2 flex items-center gap-1.5">
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700 ring-1 ring-inset ring-emerald-200">
            Complete
          </span>
          <span>delivered the full contract</span>
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700 ring-1 ring-inset ring-emerald-200">
            On track
          </span>
          <span>at or above expected</span>
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700 ring-1 ring-inset ring-amber-200">
            At risk
          </span>
          <span>{atRiskPct}–100% of expected</span>
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-red-700 ring-1 ring-inset ring-red-200">
            Behind
          </span>
          <span>under {atRiskPct}% of expected</span>
        </span>
      </span>
    </span>
  );
}

export function ContractTracker({
  campaignId,
  rows,
  weeks,
  elapsedFraction,
}: {
  campaignId: string;
  rows: ContractCreatorRow[];
  weeks: ContractWeek[];
  /** Fraction of the campaign window elapsed (0–1), for the pace flag. */
  elapsedFraction: number;
}) {
  const [view, setView] = useState<PlatformView>("all");
  const [atRisk, setAtRisk] = useState(DEFAULT_AT_RISK);

  if (rows.length === 0) return null;

  // Column totals across all creators, for the selected platform view.
  const totals = rows.reduce(
    (acc, row) => {
      const v = valuesFor(row, view);
      acc.contracted += v.contracted ?? 0;
      acc.posted += v.posted;
      for (const w of weeks) acc.week[w.key] = (acc.week[w.key] ?? 0) + v.week(w.key);
      return acc;
    },
    { contracted: 0, posted: 0, week: {} as Record<string, number> }
  );
  const totalPct =
    totals.contracted > 0
      ? Math.round((totals.posted / totals.contracted) * 100)
      : null;
  const totalPace = paceStatus(
    totals.contracted || null,
    totals.posted,
    elapsedFraction,
    atRisk
  );

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Contract Tracker
          </h3>
          <p className="text-xs text-slate-400">
            Videos delivered vs. contracted, with weekly breakdown — flag who&apos;s
            falling behind pace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            At-risk floor
            <input
              type="number"
              min={0}
              max={100}
              value={atRisk}
              onChange={(e) => {
                const n = Number(e.target.value);
                setAtRisk(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
              }}
              className="w-14 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-center text-sm tabular-nums text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
            />
            %
          </label>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {PLATFORM_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setView(t.value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  view === t.value
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-400">
              <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-medium">
                Creator
              </th>
              <th className="px-3 py-2 text-center font-medium">
                Contracted (TT / IG)
              </th>
              <th className="px-3 py-2 text-center font-medium">Posted</th>
              <th className="px-3 py-2 text-center font-medium">%</th>
              <th className="px-3 py-2 text-center font-medium">
                <span className="inline-flex items-center gap-1">
                  Pace
                  <PaceLegend atRiskPct={atRisk} />
                </span>
              </th>
              {weeks.map((w) => (
                <th
                  key={w.key}
                  className={cn(
                    "px-2 py-2 text-center font-medium whitespace-nowrap",
                    w.isCurrent && "text-blue-500"
                  )}
                >
                  <span
                    tabIndex={0}
                    className="group relative inline-block cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2 focus:outline-none"
                  >
                    {w.label}
                    <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-normal text-slate-600 shadow-lg group-hover:block group-focus:block">
                      {w.range}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => Number(b.isActive) - Number(a.isActive))
              .map((row) => {
              const v = valuesFor(row, view);
              const pace = paceStatus(v.contracted, v.posted, elapsedFraction, atRisk);
              const pct =
                v.contracted && v.contracted > 0
                  ? Math.round((v.posted / v.contracted) * 100)
                  : null;
              const total =
                row.contractedTiktok == null && row.contractedInstagram == null
                  ? null
                  : (row.contractedTiktok ?? 0) + (row.contractedInstagram ?? 0);
              return (
                <tr
                  key={row.creatorId}
                  className={cn(
                    "border-b border-slate-100 last:border-0",
                    !row.isActive && "opacity-55"
                  )}
                >
                  <td className="sticky left-0 z-10 bg-white py-2.5 pr-3">
                    <Link
                      href={`/creators/${row.creatorId}`}
                      className="block min-w-[9rem] hover:underline"
                    >
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                        @{row.creatorHandle}
                        {!row.isActive && (
                          <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Cut
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {row.creatorName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <ContractInput
                        campaignId={campaignId}
                        creatorId={row.creatorId}
                        field="contractedTiktok"
                        label="TT"
                        initial={row.contractedTiktok}
                      />
                      <ContractInput
                        campaignId={campaignId}
                        creatorId={row.creatorId}
                        field="contractedInstagram"
                        label="IG"
                        initial={row.contractedInstagram}
                      />
                      <span className="text-xs text-slate-400">
                        = <span className="font-medium text-slate-600">{total ?? "—"}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-slate-800">
                    {v.posted}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">
                    {pct == null ? "—" : `${pct}%`}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {row.isActive ? (
                      <PaceBadge pace={pace} />
                    ) : (
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                        Cut
                      </span>
                    )}
                  </td>
                  {weeks.map((w) => {
                    const c = v.week(w.key);
                    return (
                      <td
                        key={w.key}
                        className={cn(
                          "px-2 py-2.5 text-center tabular-nums",
                          c > 0 ? "text-slate-700" : "text-slate-300",
                          w.isCurrent && "bg-blue-50/50"
                        )}
                      >
                        {c}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 text-sm font-semibold text-slate-800">
              <td className="sticky left-0 z-10 bg-white py-2.5 pr-3">
                All creators
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums">
                {totals.contracted || "—"}
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums">
                {totals.posted}
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">
                {totalPct == null ? "—" : `${totalPct}%`}
              </td>
              <td className="px-3 py-2.5 text-center">
                <PaceBadge pace={totalPace} />
              </td>
              {weeks.map((w) => (
                <td
                  key={w.key}
                  className={cn(
                    "px-2 py-2.5 text-center tabular-nums",
                    w.isCurrent && "bg-blue-50/50"
                  )}
                >
                  {totals.week[w.key] ?? 0}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
