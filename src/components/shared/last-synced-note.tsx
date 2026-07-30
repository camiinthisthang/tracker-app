"use client";

import { useSyncExternalStore } from "react";
import { formatDistanceToNow } from "date-fns";

const emptySubscribe = () => () => {};

// Team standard is Eastern Time (per Jackie) — pinned so everyone reads the
// same clock regardless of where they open the dashboard. Intl handles
// EST/EDT automatically.
const EASTERN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * "Data synced Tue, Jul 29, 7:26 PM ET · 2 hours ago" — when the numbers on
 * screen were last pulled (nightly cron or force sync, whichever ran last).
 * Client-rendered after mount so the relative part never mismatches
 * hydration.
 */
export function LastSyncedNote({
  at,
  className = "text-xs text-slate-400",
  prefix = "Data synced ",
}: {
  at: string | null | undefined;
  className?: string;
  prefix?: string;
}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  if (!mounted) return null;
  if (!at) return <span className={className}>Not synced yet</span>;
  const d = new Date(at);
  return (
    <span className={className} title={d.toISOString()}>
      {prefix}
      {EASTERN.format(d)} ET · {formatDistanceToNow(d, { addSuffix: true })}
    </span>
  );
}
