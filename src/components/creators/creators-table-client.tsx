"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Flame, Search } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { FilterPills } from "@/components/creators/creator-filter-pills";
import { TierBadge } from "@/components/creators/tier-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface CreatorRow {
  id: string;
  name: string;
  handle: string;
  tier: string;
  isActive: boolean;
  postCount: number;
  recentPosts: number;
  totalViews: number;
  totalReferrals: number;
  viralCount: number;
  campaignCount: number;
  campaigns: { id: string; name: string }[];
}

const columns: ColumnDef<CreatorRow>[] = [
  {
    accessorKey: "rank",
    header: "#",
    cell: ({ row }) => (
      <span className="text-xs font-medium text-slate-400">
        {row.index + 1}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "name",
    header: "Creator",
    cell: ({ row }) => (
      <Link
        href={`/creators/${row.original.id}`}
        className="flex items-center gap-3"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
          {row.original.name[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700 hover:text-[color:var(--brand-blue)]">
            {row.original.name}
          </p>
          <p className="text-xs text-slate-400">@{row.original.handle}</p>
        </div>
      </Link>
    ),
  },
  {
    accessorKey: "tier",
    header: "Tier",
    cell: ({ row }) => <TierBadge tier={row.original.tier} />,
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        className={
          row.original.isActive
            ? "bg-green-50 text-green-600 hover:bg-green-50"
            : "bg-slate-100 text-slate-500 hover:bg-slate-100"
        }
      >
        {row.original.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    accessorKey: "postCount",
    header: "Posts",
    cell: ({ row }) => (
      <span className="text-sm text-slate-700">
        {row.original.postCount.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "recentPosts",
    header: "Posts (30d)",
    cell: ({ row }) => (
      <span
        className={
          row.original.recentPosts > 0
            ? "text-sm font-medium text-slate-700"
            : "text-sm text-slate-300"
        }
      >
        {row.original.recentPosts}
      </span>
    ),
  },
  {
    accessorKey: "totalViews",
    header: "Total Views",
    cell: ({ row }) => (
      <span className="text-sm font-medium text-slate-700">
        {row.original.totalViews.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "viralCount",
    header: () => (
      <span className="inline-flex items-center gap-1">
        <Flame className="h-3.5 w-3.5 text-orange-500" />
        Viral
      </span>
    ),
    cell: ({ row }) => (
      <span className="text-sm font-semibold text-orange-600">
        {row.original.viralCount}
      </span>
    ),
  },
  {
    accessorKey: "totalReferrals",
    header: "Referrals",
    cell: ({ row }) => (
      <span className="text-sm font-semibold text-emerald-600">
        {row.original.totalReferrals.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "campaignCount",
    header: "Campaigns",
    cell: ({ row }) => (
      <span className="text-sm text-slate-700">
        {row.original.campaignCount}
      </span>
    ),
  },
];

interface CreatorsTableClientProps {
  creators: CreatorRow[];
}

const tierFilters = [
  { label: "All", value: "all" },
  { label: "Gold", value: "GOLD" },
  { label: "Silver", value: "SILVER" },
  { label: "Bronze", value: "BRONZE" },
  { label: "Training", value: "TRAINING" },
];

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

export function CreatorsTableClient({ creators }: CreatorsTableClientProps) {
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = creators;
    const q = search.trim().toLowerCase().replace(/^@+/, "");
    if (q) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q)
      );
    }
    if (tierFilter !== "all") {
      result = result.filter((c) => c.tier === tierFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((c) =>
        statusFilter === "active" ? c.isActive : !c.isActive
      );
    }
    // Sort by referrals descending for leaderboard
    return result.sort((a, b) => b.totalReferrals - a.totalReferrals);
  }, [creators, tierFilter, statusFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            className="w-56 pl-8"
            placeholder="Search name or handle"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">Tier</p>
          <FilterPills
            options={tierFilters}
            value={tierFilter}
            onChange={setTierFilter}
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">Status</p>
          <FilterPills
            options={statusFilters}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>
      <DataTable columns={columns} data={filtered} />
    </div>
  );
}
