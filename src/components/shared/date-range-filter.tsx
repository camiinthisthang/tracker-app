"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RANGE_PRESETS, DEFAULT_RANGE_KEY } from "@/lib/date-range";

interface DateRangeFilterProps {
  rangeKey: string;
  from?: string;
  to?: string;
  basePath: string;
  /** Other query params to keep when the range changes (campaign, week…). */
  preserve?: Record<string, string>;
}

function buildUrl(
  basePath: string,
  preserve: Record<string, string>,
  range: Record<string, string>,
) {
  const q = new URLSearchParams(preserve);
  for (const [k, v] of Object.entries(range)) q.set(k, v);
  const qs = q.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function DateRangeFilter({
  rangeKey,
  from,
  to,
  basePath,
  preserve = {},
}: DateRangeFilterProps) {
  const router = useRouter();
  const [customOpen, setCustomOpen] = useState(rangeKey === "custom");
  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${
      active
        ? "bg-slate-800 text-white"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {RANGE_PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          className={pill(rangeKey === p.key && !customOpen)}
          onClick={() => {
            setCustomOpen(false);
            router.push(
              buildUrl(
                basePath,
                preserve,
                p.key === DEFAULT_RANGE_KEY ? {} : { range: p.key },
              ),
            );
          }}
        >
          {p.label}
        </button>
      ))}
      <button
        type="button"
        className={pill(rangeKey === "all" && !customOpen)}
        onClick={() => {
          setCustomOpen(false);
          router.push(buildUrl(basePath, preserve, { range: "all" }));
        }}
      >
        All time
      </button>
      <button
        type="button"
        className={pill(customOpen || rangeKey === "custom")}
        onClick={() => setCustomOpen((v) => !v)}
      >
        Custom
      </button>
      {customOpen && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!customFrom || !customTo) return;
            router.push(
              buildUrl(basePath, preserve, {
                range: "custom",
                from: customFrom,
                to: customTo,
              }),
            );
          }}
        >
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
          />
          <button
            type="submit"
            disabled={!customFrom || !customTo}
            className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            Apply
          </button>
        </form>
      )}
    </div>
  );
}
