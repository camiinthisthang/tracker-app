"use client";

import { format } from "date-fns";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DailyPoint {
  date: string;
  views: number;
}

function formatAxisValue(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function CampaignViewsChart({ data }: { data: DailyPoint[] }) {
  const chartData = data.map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    views: d.views,
  }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-400">
          No daily metrics yet. Sync the campaign to see views over time.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-800">
        Daily Views Over Time
      </h3>
      <p className="text-xs text-slate-400">
        Combined views across all creators in this campaign
      </p>
      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
          >
            <defs>
              <linearGradient id="campaignViewsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ee2324" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#ee2324" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatAxisValue}
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-white)",
                border: "1px solid var(--color-slate-200)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-slate-800)", fontWeight: 600 }}
              formatter={(value) => [
                `${Number(value).toLocaleString()} views`,
                "",
              ]}
            />
            <Area
              type="monotone"
              dataKey="views"
              stroke="#ee2324"
              strokeWidth={2}
              fill="url(#campaignViewsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
