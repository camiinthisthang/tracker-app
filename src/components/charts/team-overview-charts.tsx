"use client";

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
} from "recharts";

interface TeamOverviewChartsProps {
  viewsByDay: Array<{ date: string; views: number }>;
  topCreators: Array<{ label: string; views: number }>;
  topHooks: Array<{ label: string; views: number }>;
}

const CHART_HEIGHT = 280;

export function TeamOverviewCharts({
  viewsByDay,
  topCreators,
  topHooks,
}: TeamOverviewChartsProps) {
  const lineData = viewsByDay.map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    views: d.views,
  }));

  return (
    <div className="mb-10 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">
          Views over the last 30 days
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          Team-wide daily totals across every campaign.
        </p>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-800">
            Top 10 creators (30d)
          </h3>
          <p className="mb-4 text-xs text-slate-500">By total views.</p>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart
              data={topCreators}
              layout="vertical"
              margin={{ left: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis
                dataKey="label"
                type="category"
                width={120}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <Tooltip />
              <Bar dataKey="views" fill="#1e293b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-800">
            Top 10 hooks (30d)
          </h3>
          <p className="mb-4 text-xs text-slate-500">By total views.</p>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart
              data={topHooks}
              layout="vertical"
              margin={{ left: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis
                dataKey="label"
                type="category"
                width={160}
                tick={{ fontSize: 11, fill: "#64748b" }}
              />
              <Tooltip />
              <Bar dataKey="views" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
