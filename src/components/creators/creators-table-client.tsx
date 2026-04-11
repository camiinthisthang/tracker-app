"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { FilterPills } from "@/components/creators/creator-filter-pills";
import { TierBadge } from "@/components/creators/tier-badge";
import { Badge } from "@/components/ui/badge";

interface CreatorRow {
  id: string;
  name: string;
  handle: string;
  tier: string;
  isActive: boolean;
  postCount: number;
  totalViews: number;
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
          <p className="text-sm font-medium text-slate-700 hover:text-blue-500">
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
    accessorKey: "totalViews",
    header: "Total Views",
    cell: ({ row }) => (
      <span className="text-sm font-medium text-slate-700">
        {row.original.totalViews.toLocaleString()}
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

  const filtered = useMemo(() => {
    let result = creators;
    if (tierFilter !== "all") {
      result = result.filter((c) => c.tier === tierFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((c) =>
        statusFilter === "active" ? c.isActive : !c.isActive
      );
    }
    // Sort by totalViews descending for leaderboard
    return result.sort((a, b) => b.totalViews - a.totalViews);
  }, [creators, tierFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
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
