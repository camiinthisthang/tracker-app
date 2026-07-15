"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ExternalLink, Download } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORM_LABELS } from "@/lib/constants";

interface PostRow {
  id: string;
  title: string | null;
  link: string;
  platform: string;
  postedAt: string;
  views: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
  campaign: { id: string; name: string } | null;
}

interface CreatorPostsTableProps {
  posts: PostRow[];
  campaigns: { id: string; name: string }[];
}

const columns: ColumnDef<PostRow>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      // Fixed width, not max-width: auto table layout ignores max-width when
      // sizing columns, so long hashtag captions still blew the Title column
      // up to the full caption width. A fixed-width block is always honored.
      // Full caption stays readable on hover.
      <span
        title={row.original.title ?? undefined}
        className="block w-[220px] truncate text-sm text-slate-600"
      >
        {row.original.title || "—"}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => (
      <span className="text-sm text-slate-600">
        {PLATFORM_LABELS[row.original.platform] || row.original.platform}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "link",
    header: "Link",
    cell: ({ row }) => (
      <a
        href={row.original.link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
      >
        Link
        <ExternalLink className="h-3 w-3" />
      </a>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "postedAt",
    header: "Posted at",
    cell: ({ row }) => (
      <span className="text-sm text-slate-600">
        {format(new Date(row.original.postedAt), "EEE, MMM d, yyyy · h:mm a")}
      </span>
    ),
  },
  {
    accessorKey: "views",
    header: "Views",
    cell: ({ row }) => (
      <span className="text-sm text-slate-700">
        {row.original.views.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "likes",
    header: "Likes",
    cell: ({ row }) => (
      <span className="text-sm text-slate-700">
        {row.original.likes.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "shares",
    header: "Shares",
    cell: ({ row }) => (
      <span className="text-sm text-slate-700">
        {row.original.shares.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "saves",
    header: "Saves",
    cell: ({ row }) => (
      <span className="text-sm text-slate-700">
        {row.original.saves.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "comments",
    header: "Comments",
    cell: ({ row }) => (
      <span className="text-sm text-slate-700">
        {row.original.comments.toLocaleString()}
      </span>
    ),
  },
];

export function CreatorPostsTable({ posts, campaigns }: CreatorPostsTableProps) {
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filtered = useMemo(() => {
    let result = posts;
    if (campaignFilter !== "all") {
      result = result.filter((p) => p.campaign?.id === campaignFilter);
    }
    if (startDate) {
      result = result.filter((p) => new Date(p.postedAt) >= new Date(startDate));
    }
    if (endDate) {
      result = result.filter(
        (p) => new Date(p.postedAt) <= new Date(endDate + "T23:59:59")
      );
    }
    return result;
  }, [posts, campaignFilter, startDate, endDate]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, p) => {
          acc.views += p.views;
          acc.likes += p.likes;
          acc.shares += p.shares;
          acc.saves += p.saves;
          acc.comments += p.comments;
          return acc;
        },
        { views: 0, likes: 0, shares: 0, saves: 0, comments: 0 }
      ),
    [filtered]
  );

  function handleExportCsv() {
    const headers = [
      "Title",
      "Platform",
      "Link",
      "Posted At",
      "Views",
      "Likes",
      "Shares",
      "Saves",
      "Comments",
    ];
    const rows = filtered.map((p) => [
      p.title || "",
      PLATFORM_LABELS[p.platform] || p.platform,
      p.link,
      format(new Date(p.postedAt), "yyyy-MM-dd HH:mm"),
      p.views,
      p.likes,
      p.shares,
      p.saves,
      p.comments,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-posts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = [
    { label: "Posts", value: filtered.length },
    { label: "Views", value: totals.views },
    { label: "Likes", value: totals.likes },
    { label: "Shares", value: totals.shares },
    { label: "Saves", value: totals.saves },
    { label: "Comments", value: totals.comments },
  ];

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {summary.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-800">
              {s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        {campaigns.length > 1 && (
          <div>
            <Select
              value={campaignFilter}
              onValueChange={(v) => v && setCampaignFilter(v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[150px]"
          />
          <span className="text-sm text-slate-400">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filtered} />
    </div>
  );
}
