"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DailyMetric {
  date: string;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalPosts: number;
}

interface Campaign {
  id: string;
  name: string;
}

interface CampaignChartsClientProps {
  campaigns: Campaign[];
  metricsMap: Record<string, DailyMetric[]>;
}

export function CampaignChartsClient({
  campaigns,
  metricsMap,
}: CampaignChartsClientProps) {
  const [selectedCampaign, setSelectedCampaign] = useState(
    campaigns[0]?.id || ""
  );

  const metrics = metricsMap[selectedCampaign] || [];

  const chartData = metrics.map((m) => ({
    date: format(new Date(m.date), "MMM d"),
    views: m.totalViews,
    likes: m.totalLikes,
    comments: m.totalComments,
    shares: m.totalShares,
    posts: m.totalPosts,
  }));

  return (
    <div className="space-y-6">
      {/* Campaign selector */}
      <div className="flex items-center gap-4">
        <Select
          value={selectedCampaign}
          onValueChange={(v) => v && setSelectedCampaign(v)}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select campaign">
              {campaigns.find((c) => c.id === selectedCampaign)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {chartData.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-sm text-slate-400">
            No metrics data yet. Sync your campaign to start tracking performance.
          </p>
        </div>
      ) : (
        <>
          {/* Views over time */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">
              Views Over Time
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Engagement over time */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">
              Engagement Over Time
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="likes"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="comments"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="shares"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Posts per day */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">
              Posts Per Day
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <Tooltip />
                <Bar dataKey="posts" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
