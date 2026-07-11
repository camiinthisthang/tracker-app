import { addDays, differenceInCalendarDays, format, isValid, startOfDay } from "date-fns";

export const RANGE_PRESETS = [
  { key: "24h", label: "24h", days: 1 },
  { key: "7d", label: "7d", days: 7 },
  { key: "14d", label: "14d", days: 14 },
  { key: "90d", label: "90d", days: 90 },
] as const;

export type RangeKey = (typeof RANGE_PRESETS)[number]["key"] | "custom";

export const DEFAULT_RANGE_KEY: RangeKey = "7d";

export interface DateRange {
  key: RangeKey;
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  /** e.g. "Last 7 days" or "Jun 1 – Jun 15" */
  label: string;
  /** e.g. "vs previous 7 days" */
  compareLabel: string;
  /** Custom bounds as YYYY-MM-DD, only set for key="custom". */
  from?: string;
  to?: string;
}

function single(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Parse ?range=24h|7d|14d|90d|custom (+ ?from/?to for custom, YYYY-MM-DD)
 * into a window plus the equal-length window immediately before it, for
 * period-over-period deltas. Anything invalid falls back to the 7d default.
 */
export function parseDateRange(
  params: Record<string, string | string[] | undefined>,
  now = new Date(),
): DateRange {
  const key = single(params.range) ?? DEFAULT_RANGE_KEY;

  if (key === "custom") {
    const from = single(params.from);
    const to = single(params.to);
    const start = from ? startOfDay(new Date(`${from}T00:00:00`)) : null;
    const toDay = to ? startOfDay(new Date(`${to}T00:00:00`)) : null;
    if (start && toDay && isValid(start) && isValid(toDay) && start <= toDay) {
      const end = addDays(toDay, 1);
      const days = differenceInCalendarDays(end, start);
      return {
        key: "custom",
        start,
        end,
        prevStart: addDays(start, -days),
        prevEnd: start,
        label: `${format(start, "MMM d")} – ${format(toDay, "MMM d, yyyy")}`,
        compareLabel: `vs previous ${days} day${days === 1 ? "" : "s"}`,
        from,
        to,
      };
    }
    // fall through to default preset on bad input
  }

  const preset =
    RANGE_PRESETS.find((p) => p.key === key) ??
    RANGE_PRESETS.find((p) => p.key === DEFAULT_RANGE_KEY)!;
  const end = now;
  const start = addDays(end, -preset.days);
  return {
    key: preset.key,
    start,
    end,
    prevStart: addDays(start, -preset.days),
    prevEnd: start,
    label: preset.days === 1 ? "Last 24 hours" : `Last ${preset.days} days`,
    compareLabel:
      preset.days === 1 ? "vs previous 24h" : `vs previous ${preset.days} days`,
  };
}

/** Query params that reproduce this range (empty for the default). */
export function rangeParams(range: DateRange): Record<string, string> {
  if (range.key === DEFAULT_RANGE_KEY) return {};
  if (range.key === "custom" && range.from && range.to) {
    return { range: "custom", from: range.from, to: range.to };
  }
  return { range: range.key };
}
