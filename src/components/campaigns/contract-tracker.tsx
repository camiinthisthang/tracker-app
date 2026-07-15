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
  /** Monthly rate in USD; null = not set. Drives the payout column. */
  monthlyRate: number | null;
  /** Contract window (YYYY-MM-DD or null = campaign start/end). */
  contractStart: string | null;
  contractEnd: string | null;
  /** 1-week warm-up leeway after the contract start (pace-exempt). */
  hasWarmupWeek: boolean;
  /** Fraction of THIS creator's contract window elapsed (0–1) — a creator
   * who signed mid-campaign is paced against their own dates, not the whole
   * campaign's. */
  elapsedFraction: number;
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

const DEFAULT_ON_TRACK = 75;
const DEFAULT_AT_RISK = 40;

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
 * Two tolerance bands, both % of expected and both live-adjustable:
 *   - On track  = at or above `onTrackPct`% of expected (keeping pace, give or take)
 *   - At risk   = between `atRiskPct`% and `onTrackPct`% (slipping)
 *   - Behind    = under `atRiskPct`%
 * Posting is lumpy, so On track is a band around the pace line, not a knife-edge
 * at 100% — otherwise anyone a hair below the line reads as At risk.
 */
function paceStatus(
  contracted: number | null,
  posted: number,
  elapsedFraction: number,
  onTrackPct: number,
  atRiskPct: number
): { label: string; cls: string } | null {
  if (!contracted || contracted <= 0) return null;
  if (posted >= contracted)
    return { label: "Complete", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  const expected = contracted * elapsedFraction;
  if (posted >= expected * (onTrackPct / 100))
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
        className="w-12 rounded-md border border-slate-200 bg-white px-1 py-1 text-center text-sm tabular-nums text-slate-800 focus:border-[color:var(--brand-blue)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-blue)]/30 disabled:opacity-50"
      />
    </label>
  );
}

/** Inline-editable monthly rate (USD) for one creator on this campaign. */
function RateInput({
  campaignId,
  creatorId,
  initial,
}: {
  campaignId: string;
  creatorId: string;
  initial: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial != null ? String(initial) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const next = value.trim();
    if (next === (initial != null ? String(initial) : "")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/creators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId, monthlyRate: next === "" ? null : next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Save failed");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      setValue(initial != null ? String(initial) : "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex items-center justify-center gap-0.5">
      <span className="text-xs text-slate-400">$</span>
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder="—"
        className="w-20 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-sm tabular-nums text-slate-800 focus:border-[color:var(--brand-blue)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-blue)]/30 disabled:opacity-50"
      />
    </label>
  );
}

/** Inline-editable contract date (start or end) for one creator. */
function DateInput({
  campaignId,
  creatorId,
  field,
  label,
  initial,
}: {
  campaignId: string;
  creatorId: string;
  field: "contractStart" | "contractEnd";
  label: string;
  initial: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const next = value.trim();
    if (next === (initial ?? "")) return;
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
      setValue(initial ?? "");
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
        type="date"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-[8.2rem] rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs tabular-nums text-slate-800 focus:border-[color:var(--brand-blue)] focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-blue)]/30 disabled:opacity-50"
      />
    </label>
  );
}

/** Warm-up leeway toggle: the first contract week is pace-exempt when on. */
function WarmupToggle({
  campaignId,
  creatorId,
  initial,
}: {
  campaignId: string;
  creatorId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save(next: boolean) {
    setChecked(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/creators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId, hasWarmupWeek: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Save failed");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      setChecked(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <label
      className="flex cursor-pointer items-center gap-1 text-[10px] font-medium uppercase text-slate-400"
      title="1-week warm-up: the first week after the contract start doesn't count against pace (posts made during it still count as delivered)"
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={saving}
        onChange={(e) => save(e.target.checked)}
        className="h-3 w-3 cursor-pointer accent-[color:var(--brand-blue)] disabled:opacity-50"
      />
      Warm-up wk
    </label>
  );
}

/** Format a USD amount: whole dollars when even, else 2 decimals. */
function fmtUSD(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Payout = monthly rate × min(delivered ÷ contracted, 1), capped at 100%.
 * Always uses the combined TT+IG basis (a crossposted video counts on both
 * platforms), independent of the platform tab. Null if rate or contract unset.
 */
function payoutFor(row: ContractCreatorRow): number | null {
  if (row.monthlyRate == null) return null;
  const contracted =
    (row.contractedTiktok ?? 0) + (row.contractedInstagram ?? 0);
  if (contracted <= 0) return null;
  const posted = row.postedTiktok + row.postedInstagram;
  const ratio = Math.min(posted / contracted, 1);
  return Math.round(row.monthlyRate * ratio * 100) / 100;
}

/** Info icon that reveals the pace-legend popover on hover/focus. */
function PaceLegend({
  onTrackPct,
  atRiskPct,
}: {
  onTrackPct: number;
  atRiskPct: number;
}) {
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
          Expected = contracted × % of the creator&apos;s contract window
          elapsed (their dates in the Contract dates column, or the campaign
          window when unset). With &quot;Warm-up wk&quot; on, the first week
          after the start is leeway — expected stays at 0 until it ends. The
          bands are a tolerance around that pace — drag the sliders to adjust.
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
          <span>at or above {onTrackPct}% of expected</span>
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700 ring-1 ring-inset ring-amber-200">
            At risk
          </span>
          <span>
            {atRiskPct}–{onTrackPct}% of expected
          </span>
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
  const [onTrack, setOnTrack] = useState(DEFAULT_ON_TRACK);
  const [atRisk, setAtRisk] = useState(DEFAULT_AT_RISK);

  if (rows.length === 0) return null;

  // Column totals across all creators, for the selected platform view.
  const totals = rows.reduce(
    (acc, row) => {
      const v = valuesFor(row, view);
      acc.contracted += v.contracted ?? 0;
      acc.posted += v.posted;
      acc.payout += payoutFor(row) ?? 0;
      for (const w of weeks) acc.week[w.key] = (acc.week[w.key] ?? 0) + v.week(w.key);
      return acc;
    },
    { contracted: 0, posted: 0, payout: 0, week: {} as Record<string, number> }
  );
  const totalPct =
    totals.contracted > 0
      ? Math.round((totals.posted / totals.contracted) * 100)
      : null;
  const totalPace = paceStatus(
    totals.contracted || null,
    totals.posted,
    elapsedFraction,
    onTrack,
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
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-14 shrink-0">On track ≥</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={onTrack}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setOnTrack(n);
                  // At risk can't sit above the On-track line.
                  if (atRisk > n) setAtRisk(n);
                }}
                className="h-1.5 w-28 cursor-pointer accent-[color:var(--brand-blue)]"
                aria-label="On-track threshold, % of expected"
              />
              <span className="w-9 tabular-nums font-medium text-slate-700">
                {onTrack}%
              </span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-14 shrink-0">At risk ≥</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={atRisk}
                onChange={(e) => setAtRisk(Math.min(Number(e.target.value), onTrack))}
                className="h-1.5 w-28 cursor-pointer accent-amber-500"
                aria-label="At-risk threshold, % of expected"
              />
              <span className="w-9 tabular-nums font-medium text-slate-700">
                {atRisk}%
              </span>
            </label>
          </div>
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
              <th
                className="cursor-help px-3 py-2 text-center font-medium"
                title="This creator's contract window. Pace and posted counts are measured against these dates — warm-up posts before the start don't count. Empty = the whole campaign window."
              >
                Contract dates
              </th>
              <th className="px-3 py-2 text-center font-medium">Rate / mo</th>
              <th className="px-3 py-2 text-center font-medium">Posted</th>
              <th className="px-3 py-2 text-center font-medium">%</th>
              <th className="px-3 py-2 text-center font-medium">Payout</th>
              <th className="px-3 py-2 text-center font-medium">
                <span className="inline-flex items-center gap-1">
                  Pace
                  <PaceLegend onTrackPct={onTrack} atRiskPct={atRisk} />
                </span>
              </th>
              {weeks.map((w, i) => {
                const month = Math.floor(i / 4) + 1;
                const weekInMonth = (i % 4) + 1;
                const monthStart = i % 4 === 0 && i > 0;
                return (
                <th
                  key={w.key}
                  className={cn(
                    "px-2 py-2 text-center font-medium whitespace-nowrap",
                    w.isCurrent && "text-[color:var(--brand-blue)]",
                    monthStart && "border-l border-slate-200"
                  )}
                >
                  <span
                    tabIndex={0}
                    className="group relative inline-block cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2 focus:outline-none"
                  >
                    M{month}·W{weekInMonth}
                    <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-normal text-slate-600 shadow-lg group-hover:block group-focus:block">
                      {w.range}
                    </span>
                  </span>
                </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => Number(b.isActive) - Number(a.isActive))
              .map((row) => {
              const v = valuesFor(row, view);
              const payout = payoutFor(row);
              const pace = paceStatus(
                v.contracted,
                v.posted,
                row.elapsedFraction,
                onTrack,
                atRisk
              );
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
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col items-center gap-1">
                      <DateInput
                        campaignId={campaignId}
                        creatorId={row.creatorId}
                        field="contractStart"
                        label="From"
                        initial={row.contractStart}
                      />
                      <DateInput
                        campaignId={campaignId}
                        creatorId={row.creatorId}
                        field="contractEnd"
                        label="To"
                        initial={row.contractEnd}
                      />
                      <WarmupToggle
                        campaignId={campaignId}
                        creatorId={row.creatorId}
                        initial={row.hasWarmupWeek}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <RateInput
                      campaignId={campaignId}
                      creatorId={row.creatorId}
                      initial={row.monthlyRate}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-slate-800">
                    {v.posted}
                    {v.contracted != null &&
                      v.contracted > 0 &&
                      v.posted > v.contracted && (
                        <span
                          className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                          title="Delivered beyond the contracted count — these extras are paid per video, not another month"
                        >
                          +{v.posted - v.contracted}
                        </span>
                      )}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">
                    {pct == null ? "—" : `${pct}%`}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {payout == null ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className="font-semibold tabular-nums text-[color:var(--brand-blue)]">
                        {fmtUSD(payout)}
                      </span>
                    )}
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
                  {weeks.map((w, i) => {
                    const c = v.week(w.key);
                    const monthStart = i % 4 === 0 && i > 0;
                    return (
                      <td
                        key={w.key}
                        className={cn(
                          "px-2 py-2.5 text-center tabular-nums",
                          c > 0 ? "text-slate-700" : "text-slate-300",
                          w.isCurrent && "bg-[color:var(--brand-blue)]/5",
                          monthStart && "border-l border-slate-200"
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
              <td className="px-3 py-2.5 text-center text-slate-300">—</td>
              <td className="px-3 py-2.5 text-center text-slate-300">—</td>
              <td className="px-3 py-2.5 text-center tabular-nums">
                {totals.posted}
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">
                {totalPct == null ? "—" : `${totalPct}%`}
              </td>
              <td className="px-3 py-2.5 text-center font-bold tabular-nums text-[color:var(--brand-blue)]">
                {totals.payout > 0 ? fmtUSD(totals.payout) : "—"}
              </td>
              <td className="px-3 py-2.5 text-center">
                <PaceBadge pace={totalPace} />
              </td>
              {weeks.map((w, i) => (
                <td
                  key={w.key}
                  className={cn(
                    "px-2 py-2.5 text-center tabular-nums",
                    w.isCurrent && "bg-[color:var(--brand-blue)]/5",
                    i % 4 === 0 && i > 0 && "border-l border-slate-200"
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
