"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface WeekOption {
  /** ISO date string for the Monday of the week. Used in the URL. */
  value: string;
  /** Human label, e.g. "Jun 1 – Jun 7". */
  label: string;
  /** Marker text appended in the dropdown, e.g. "this week", "current". */
  tag?: string;
}

interface Props {
  weeks: WeekOption[];
  current: string;
}

export function WeekSelector({ weeks, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function onChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams();
    params.set("week", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[220px] bg-white text-sm">
        <SelectValue placeholder="Select week" />
      </SelectTrigger>
      <SelectContent>
        {weeks.map((w) => (
          <SelectItem key={w.value} value={w.value}>
            {w.label}
            {w.tag && (
              <span className="ml-2 text-xs text-slate-400">{w.tag}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
