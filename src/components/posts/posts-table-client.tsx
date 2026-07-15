"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, Download } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { FilterPills } from "@/components/creators/creator-filter-pills";
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
  username: string;
  title: string | null;
  link: string;
  platform: string;
  postedAt: string;
  views: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
  creator: { id: string; name: string; handle: string };
  campaign: { id: string; name: string };
}

interface PostsTableClientProps {
  posts: PostRow[];
  campaigns: { id: string; name: string }[];
  creators: { id: string; handle: string }[];
}

const columns: ColumnDef<PostRow>[] = [
  {
    accessorKey: "creator",
    header: "Creator",
    cell: ({ row }) => {
      // With multi-account creators the posting account can differ from the
      // profile's main handle — show which account the post came from.
      const viaOtherAccount =
        row.original.username.toLowerCase() !==
        row.original.creator.handle.toLowerCase();
      return (
        <div>
          <Link
            href={`/creators/${row.original.creator.id}`}
            title={`Open ${row.original.creator.name}'s creator page`}
            className="text-sm font-medium text-slate-700 hover:text-blue-600 hover:underline"
          >
            {row.original.creator.handle}
          </Link>
          {viaOtherAccount && (
            <p className="text-xs text-slate-400">
              via @{row.original.username}
            </p>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "campaign",
    header: "Campaign",
    cell: ({ row }) => (
      <span className="text-sm text-slate-600">
        {row.original.campaign.name}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        {PLATFORM_LABELS[row.original.platform] ?? row.original.platform}
      </span>
    ),
    enableSorting: false,
  },
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
        className="block w-[200px] truncate text-sm text-slate-600"
      >
        {row.original.title || "—"}
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

export function PostsTableClient({
  posts,
  campaigns,
  creators,
}: PostsTableClientProps) {
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const creatorPills = useMemo(
    () => [
      { label: "All Creators", value: "all" },
      ...creators.map((c) => ({ label: c.handle, value: c.id })),
    ],
    [creators]
  );

  const filtered = useMemo(() => {
    let result = posts;
    if (campaignFilter !== "all") {
      result = result.filter((p) => p.campaign.id === campaignFilter);
    }
    if (creatorFilter !== "all") {
      result = result.filter((p) => p.creator.id === creatorFilter);
    }
    if (startDate) {
      result = result.filter(
        (p) => new Date(p.postedAt) >= new Date(startDate)
      );
    }
    if (endDate) {
      result = result.filter(
        (p) => new Date(p.postedAt) <= new Date(endDate + "T23:59:59")
      );
    }
    return result;
  }, [posts, campaignFilter, creatorFilter, startDate, endDate]);

  function handleExportCsv() {
    const headers = [
      "Creator",
      "Account",
      "Campaign",
      "Title",
      "Link",
      "Platform",
      "Posted At",
      "Views",
      "Likes",
      "Shares",
      "Saves",
      "Comments",
    ];
    const rows = filtered.map((p) => [
      p.creator.handle,
      p.username,
      p.campaign.name,
      p.title || "",
      p.link,
      PLATFORM_LABELS[p.platform] || p.platform,
      format(new Date(p.postedAt), "yyyy-MM-dd HH:mm"),
      p.views,
      p.likes,
      p.shares,
      p.saves,
      p.comments,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `posts-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Select value={campaignFilter} onValueChange={(v) => v && setCampaignFilter(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                {campaignFilter === "all"
                  ? "All Campaigns"
                  : campaigns.find((c) => c.id === campaignFilter)?.name ??
                    "All Campaigns"}
              </SelectValue>
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
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[150px]"
            placeholder="Start date"
          />
          <span className="text-sm text-slate-400">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[150px]"
            placeholder="End date"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
      </div>

      {/* Creator pills */}
      <FilterPills
        options={creatorPills}
        value={creatorFilter}
        onChange={setCreatorFilter}
      />

      {/* Table */}
      <DataTable columns={columns} data={filtered} pageSize={25} />
    </div>
  );
}
