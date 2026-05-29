"use client";

import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  ExternalLink,
  Eye,
  Flame,
  Heart,
  Minus,
  Send,
} from "lucide-react";
import type { ReportData } from "@/lib/reports/report-data";

function fmt(n: number): string {
  return n.toLocaleString();
}
function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
function platformLabel(p: string): string {
  return p === "TIKTOK" ? "TikTok" : p === "INSTAGRAM" ? "Instagram" : p;
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #client-report, #client-report * { visibility: visible !important; }
  #client-report { position: absolute; left: 0; top: 0; width: 100%; }
  .print-hidden { display: none !important; }
  .report-card { break-inside: avoid; }
}
`;

function HeroCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`report-card rounded-xl p-5 text-white ${color}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">
          {label}
        </p>
        <span className="opacity-80">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-80">{sub}</p>}
    </div>
  );
}

function DeltaPill({ delta, pctChange }: { delta: number; pctChange: number | null }) {
  const up = delta > 0;
  const flat = delta === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const tone = flat
    ? "bg-slate-100 text-slate-500"
    : up
    ? "bg-emerald-50 text-emerald-700"
    : "bg-red-50 text-red-700";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      <Icon className="h-3 w-3" />
      {delta >= 0 ? "+" : ""}
      {compact(delta)}
      {pctChange !== null && ` (${(pctChange * 100).toFixed(0)}%)`}
    </span>
  );
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="report-card rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function RangeControl({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const from = startDate.slice(0, 10);
  const to = endDate.slice(0, 10);

  const apply = (nextFrom: string, nextTo: string) => {
    if (!nextFrom || !nextTo) return;
    const params = new URLSearchParams({ from: nextFrom, to: nextTo });
    router.push(`${pathname}?${params.toString()}`);
  };

  const preset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    apply(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  };

  const inputCls =
    "rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none";
  const presetCls =
    "rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600";

  return (
    <div className="print-hidden flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={from}
        max={to}
        onChange={(e) => apply(e.target.value, to)}
        className={inputCls}
      />
      <span className="text-slate-400">→</span>
      <input
        type="date"
        value={to}
        min={from}
        onChange={(e) => apply(from, e.target.value)}
        className={inputCls}
      />
      <button type="button" onClick={() => preset(7)} className={presetCls}>
        Week
      </button>
      <button type="button" onClick={() => preset(30)} className={presetCls}>
        Month
      </button>
    </div>
  );
}

export function ClientReport({ data }: { data: ReportData }) {
  const dateRange = `${format(new Date(data.startDate), "MMM d, yyyy")} – ${format(
    new Date(data.endDate),
    "MMM d, yyyy"
  )}`;

  const trendData = data.trend.map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    views: d.views,
    engagements: d.engagements,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div id="client-report" className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="report-card mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
              {data.scope.type === "campaign" ? "Campaign report" : "Client report"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-800">{data.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {data.subtitle} · {dateRange}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="print-hidden inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <RangeControl startDate={data.startDate} endDate={data.endDate} />
          </div>
        </div>

        {/* Tier 1 — Hero KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HeroCard
            label="Posts shipped"
            value={fmt(data.hero.postsShipped)}
            icon={<Send className="h-4 w-4" />}
            color="bg-slate-800"
          />
          <HeroCard
            label="Total views"
            value={compact(data.hero.totalViews)}
            sub={`${fmt(data.hero.totalViews)} total`}
            icon={<Eye className="h-4 w-4" />}
            color="bg-blue-600"
          />
          <HeroCard
            label="Engagement rate"
            value={pct(data.hero.engagementRate)}
            sub={`${compact(data.hero.totalEngagements)} engagements`}
            icon={<Heart className="h-4 w-4" />}
            color="bg-emerald-600"
          />
          <HeroCard
            label="Viral posts"
            value={fmt(data.hero.viralPosts)}
            sub={`≥ ${compact(data.hero.viralThreshold)} views (3× median)`}
            icon={<Flame className="h-4 w-4" />}
            color="bg-amber-500"
          />
        </div>

        {/* WoW deltas */}
        {data.wow && (
          <div className="report-card mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Posts vs prev period</p>
              <div className="mt-1">
                <DeltaPill delta={data.wow.posts.delta} pctChange={data.wow.posts.pctChange} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Views vs prev period</p>
              <div className="mt-1">
                <DeltaPill delta={data.wow.views.delta} pctChange={data.wow.views.pctChange} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Engagement vs prev period</p>
              <div className="mt-1">
                <DeltaPill
                  delta={data.wow.engagements.delta}
                  pctChange={data.wow.engagements.pctChange}
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Viral vs prev period</p>
              <div className="mt-1">
                <DeltaPill
                  delta={data.wow.viralPosts.delta}
                  pctChange={data.wow.viralPosts.pctChange}
                />
              </div>
            </div>
          </div>
        )}

        {/* Trend */}
        <div className="mt-6">
          <SectionCard title="Views over time" hint="cumulative">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="rv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip formatter={(value) => [`${fmt(Number(value))} views`, ""]} />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#3b82f6"
                    fill="url(#rv)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No trend data yet.</p>
            )}
          </SectionCard>
        </div>

        {/* Platform leaderboard */}
        <div className="mt-6">
          <SectionCard title="Platform leaderboard">
            <div className="space-y-3">
              {data.platforms.map((p) => {
                const isLeader = p.platform === data.leaderPlatform;
                return (
                  <div
                    key={p.platform}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      isLeader ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        {platformLabel(p.platform)}
                      </span>
                      {isLeader && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                          Leader
                        </span>
                      )}
                    </div>
                    <div className="flex gap-6 text-right">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{compact(p.views)}</p>
                        <p className="text-[10px] uppercase text-slate-400">views</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{pct(p.engagementRate)}</p>
                        <p className="text-[10px] uppercase text-slate-400">eng rate</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{fmt(p.posts)}</p>
                        <p className="text-[10px] uppercase text-slate-400">posts</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{compact(p.viewsPerPost)}</p>
                        <p className="text-[10px] uppercase text-slate-400">views/post</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {data.platforms.length === 0 && (
                <p className="text-sm text-slate-400">No posts yet.</p>
              )}
            </div>
            {data.underperformingPlatform && (
              <p className="mt-3 text-xs text-slate-500">
                Lagging:{" "}
                <span className="font-medium text-slate-700">
                  {platformLabel(data.underperformingPlatform)}
                </span>{" "}
                — lowest reach this period.
              </p>
            )}
          </SectionCard>
        </div>

        {/* Top viral posts */}
        <div className="mt-6">
          <SectionCard title="Top performing posts" hint="by views">
            <div className="space-y-2">
              {data.topViralPosts.map((post, idx) => (
                <a
                  key={post.id}
                  href={post.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 hover:bg-blue-50"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-500">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {post.caption || "Untitled"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {post.creatorName} · @{post.creatorHandle} ·{" "}
                      {platformLabel(post.platform)} ·{" "}
                      {format(new Date(post.postedAt), "MMM d")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-800">{compact(post.views)}</p>
                    <p className="text-[10px] text-slate-400">{pct(post.engagementRate)} eng</p>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-blue-500" />
                </a>
              ))}
              {data.topViralPosts.length === 0 && (
                <p className="text-sm text-slate-400">No posts yet.</p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Top captions */}
        {data.topCaptions.length > 0 && (
          <div className="mt-6">
            <SectionCard title="Top captions" hint="highest engagement">
              <div className="space-y-3">
                {data.topCaptions.map((post) => (
                  <a
                    key={post.id}
                    href={post.link}
                    target="_blank"
                    rel="noreferrer"
                    className="group block rounded-lg border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-slate-700">{post.caption}</p>
                      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-blue-500" />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {post.creatorName} · @{post.creatorHandle} ·{" "}
                      {platformLabel(post.platform)} · {pct(post.engagementRate)} engagement ·{" "}
                      {compact(post.views)} views
                    </p>
                  </a>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Posting time + caption length */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <SectionCard title="Best day to post" hint="avg views by weekday">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.postingByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip formatter={(value) => [fmt(Number(value)), "avg views"]} />
                <Bar dataKey="avgViews" radius={[4, 4, 0, 0]}>
                  {data.postingByDay.map((d, i) => (
                    <Cell key={i} fill={d.posts > 0 ? "#3b82f6" : "#e2e8f0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Caption length sweet spot" hint="avg views by length">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.captionLength}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip
                  formatter={(value, _n, item) => [
                    fmt(Number(value)),
                    `${item?.payload?.posts ?? 0} posts`,
                  ]}
                />
                <Bar dataKey="avgViews" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        {/* Per-creator breakdown */}
        <div className="mt-6">
          <SectionCard title="Creator breakdown">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                    <th className="pb-2 font-medium">Creator</th>
                    <th className="pb-2 text-right font-medium">Posts</th>
                    <th className="pb-2 text-right font-medium">Views</th>
                    <th className="pb-2 text-right font-medium">Eng rate</th>
                    <th className="pb-2 text-right font-medium">Best post</th>
                  </tr>
                </thead>
                <tbody>
                  {data.creators.map((c) => (
                    <tr key={c.creatorId} className="border-b border-slate-100">
                      <td className="py-2">
                        <p className="font-medium text-slate-700">{c.name}</p>
                        <p className="text-xs text-slate-400">@{c.handle}</p>
                      </td>
                      <td className="py-2 text-right text-slate-700">{fmt(c.posts)}</td>
                      <td className="py-2 text-right text-slate-700">{compact(c.views)}</td>
                      <td className="py-2 text-right text-slate-700">{pct(c.engagementRate)}</td>
                      <td className="py-2 text-right text-slate-700">{compact(c.bestPostViews)}</td>
                    </tr>
                  ))}
                  {data.creators.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-slate-400">
                        No creators yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Generated {format(new Date(data.generatedAt), "MMM d, yyyy 'at' h:mm a")} · DropDeck
        </p>
      </div>
    </div>
  );
}
