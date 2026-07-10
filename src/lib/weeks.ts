import { addDays, format, startOfWeek, subWeeks } from "date-fns";

/**
 * Calendar-week window (Mon–Sun) for the dashboard's week navigation.
 * offset 0 = the week containing `now`, 1 = last week, etc.
 */
export function getWeekWindow(offset: number, now = new Date()) {
  const start = startOfWeek(subWeeks(now, offset), { weekStartsOn: 1 });
  const end = addDays(start, 7);
  const label =
    offset === 0
      ? "This week"
      : offset === 1
        ? "Last week"
        : `${offset} weeks ago`;
  const range = `${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d")}`;
  return { start, end, label, range };
}

export function parseWeekOffset(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, 52);
}
