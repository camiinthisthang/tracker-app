"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreatorPacingCard,
  type CreatorPacingCardData,
} from "@/components/creators/creator-pacing-card";

type SortKey = "default" | "progress" | "views" | "name" | "posts";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Default order" },
  { value: "progress", label: "Progress (lowest first)" },
  { value: "views", label: "Views (highest first)" },
  { value: "posts", label: "Posts this month" },
  { value: "name", label: "Name A–Z" },
];

function matches(c: CreatorPacingCardData, q: string) {
  const needle = q.toLowerCase();
  return (
    c.name.toLowerCase().includes(needle) ||
    c.handle.toLowerCase().includes(needle) ||
    c.campaignNames.some((n) => n.toLowerCase().includes(needle))
  );
}

function sorted(cards: CreatorPacingCardData[], key: SortKey) {
  if (key === "default") return cards;
  const copy = [...cards];
  switch (key) {
    case "progress":
      return copy.sort((a, b) => {
        const ra = a.monthlyGoal > 0 ? a.postsThisMonth / a.monthlyGoal : 1;
        const rb = b.monthlyGoal > 0 ? b.postsThisMonth / b.monthlyGoal : 1;
        return ra - rb;
      });
    case "views":
      return copy.sort((a, b) => b.views - a.views);
    case "posts":
      return copy.sort((a, b) => b.postsThisMonth - a.postsThisMonth);
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function CreatorsCardsClient({
  needsAttention,
  onTrack,
  inactive,
  legend,
  periodLabel,
}: {
  needsAttention: CreatorPacingCardData[];
  onTrack: CreatorPacingCardData[];
  inactive: { id: string; name: string; tag?: string }[];
  legend: React.ReactNode;
  periodLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("default");

  const attention = useMemo(
    () => sorted(query ? needsAttention.filter((c) => matches(c, query)) : needsAttention, sort),
    [needsAttention, query, sort],
  );
  const tracking = useMemo(
    () => sorted(query ? onTrack.filter((c) => matches(c, query)) : onTrack, sort),
    [onTrack, query, sort],
  );
  const inactiveShown = query
    ? inactive.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : inactive;

  return (
    <>
      {/* Search + sort */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, handle or campaign…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={sort} onValueChange={(v) => v && setSort(v as SortKey)}>
          <SelectTrigger className="w-[210px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {query && (
          <span className="text-xs text-slate-400">
            {attention.length + tracking.length} match
            {attention.length + tracking.length === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {/* Needs attention */}
      {attention.length > 0 && (
        <div className="mb-8">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-800">
                Needs attention
              </h2>
              <span className="text-xs text-slate-400">
                Pacing month: {periodLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{legend}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map((c) => (
              <CreatorPacingCard key={c.id} creator={c} />
            ))}
          </div>
        </div>
      )}

      {/* On track */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-slate-800">On track</h2>
        </div>
        {tracking.length === 0 ? (
          <p className="text-sm text-slate-400">
            {query
              ? "No matches in this group."
              : "No one's fully on track yet this month."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tracking.map((c) => (
              <CreatorPacingCard key={c.id} creator={c} />
            ))}
          </div>
        )}
      </div>

      {/* Off the main roster: deactivated (sync stopped), cut from every
          campaign (still synced, just not paced here), or campaign ended. */}
      {inactiveShown.length > 0 && (
        <div className="mt-8">
          <h2
            className="mb-2 cursor-help text-sm font-semibold text-slate-500"
            title="Deactivated = syncing stopped. Cut = removed from campaign pacing but their posts still sync, so viral videos are caught."
          >
            Not on an active campaign
          </h2>
          <div className="flex flex-wrap gap-2">
            {inactiveShown.map((c) => (
              <Link
                key={c.id}
                href={`/creators/${c.id}`}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 hover:bg-slate-200"
              >
                {c.name}
                {c.tag && (
                  <span className="ml-1 text-slate-400">· {c.tag}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
