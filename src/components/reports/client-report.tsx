"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  Minus,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
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
  return p === "TIKTOK"
    ? "TikTok"
    : p === "INSTAGRAM"
      ? "Instagram"
      : p === "YOUTUBE"
        ? "YouTube"
        : p;
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

// Subtle grain overlay for the royal-blue header/footer strips. Inline SVG
// noise avoids shipping a separate /grain.png asset.
const GRAIN_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E";

const ROYAL_SURFACE: React.CSSProperties = {
  background: "#EE2324",
  backgroundImage: `url("${GRAIN_URL}")`,
  backgroundSize: "240px",
  backgroundBlendMode: "overlay",
};

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "#120D0B",
  border: "none",
  borderRadius: 8,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  color: "white",
  padding: "8px 12px",
};

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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] ${tone}`}
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
    <div className="report-card rounded-2xl bg-bone-100 p-8">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="font-mono text-[11px] tracking-[0.02em] text-ink-900/45">
          {title}
        </span>
        {hint && (
          <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-ink-300">
            {hint}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function RangeControl({
  startDate,
  endDate,
  scopeType,
}: {
  startDate: string;
  endDate: string;
  scopeType: "campaign" | "client";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = startDate.slice(0, 10);
  const to = endDate.slice(0, 10);

  const apply = (nextFrom: string, nextTo: string) => {
    if (!nextFrom || !nextTo) return;
    // Preserve other params (e.g. the agency `team` selection) when the range
    // changes — only the date bounds are overwritten.
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    router.push(`${pathname}?${params.toString()}`);
  };

  const preset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    apply(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  };

  // Clearing the bounds falls back to the server default — the full
  // campaign/client history window.
  const resetToFull = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  // Rendered on the royal-blue header, so the controls read on a dark surface.
  // color-scheme:dark makes the native date text + calendar glyph light.
  const inputCls =
    "rounded-full border border-white/30 bg-white/15 px-3 py-1.5 font-mono text-[12px] text-white [color-scheme:dark] focus:border-white/60 focus:outline-none";
  const presetCls =
    "rounded-full border border-white/30 bg-white/15 px-3 py-1.5 font-mono text-[11px] text-white hover:bg-white/25";

  return (
    <div className="print-hidden flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={from}
        max={to}
        onChange={(e) => apply(e.target.value, to)}
        className={inputCls}
      />
      <span className="text-white/60">→</span>
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
      <button type="button" onClick={resetToFull} className={presetCls}>
        {scopeType === "campaign" ? "Full campaign" : "All time"}
      </button>
    </div>
  );
}

// `publicView` renders the shareable client-facing variant: no date-range
// controls (the link is pinned to the full campaign), print/PDF stays.
export function ClientReport({
  data,
  publicView = false,
}: {
  data: ReportData;
  publicView?: boolean;
}) {
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
    <div className="min-h-screen bg-[#E5E5E5]">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div
        id="client-report"
        className="mx-auto flex max-w-[960px] flex-col gap-4 px-6 py-6"
      >
        {/* Header */}
        <div
          className="mb-0 flex flex-col gap-5 rounded-2xl px-12 py-8"
          style={ROYAL_SURFACE}
        >
          <div className="flex items-start justify-between gap-4">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-lime-500">
              {data.scope.type === "campaign" ? "Campaign report" : "Client report"}
            </p>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="print-hidden inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 font-mono text-[11px] text-white hover:bg-white/25"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
              {!publicView && (
                <RangeControl
                  startDate={data.startDate}
                  endDate={data.endDate}
                  scopeType={data.scope.type}
                />
              )}
            </div>
          </div>
          <div>
            <h1 className="mt-1 font-display text-[34px] font-extrabold lowercase leading-none tracking-tight text-white">
              {data.title}
            </h1>
            <p className="mt-2 font-mono text-[12px] text-white/55">
              {data.subtitle} · {dateRange}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-[11px] lowercase text-white">
              {fmt(data.hero.postsShipped)} posts
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-[11px] lowercase text-white">
              {compact(data.hero.totalViews)} views
            </span>
          </div>
        </div>

        {/* Tier 1 — Hero KPIs */}
        <div className="rounded-2xl bg-bone-100 px-12 py-10">
          <div className="mb-0 flex justify-between font-mono text-[11px] tracking-[0.02em] text-ink-900/45">
            <span>performance overview</span>
            {data.wow && <span>vs. previous period</span>}
          </div>
          <div className="mt-7 grid grid-cols-4 border-t border-bone-200">
            <div className="border-r border-bone-200 py-6 pr-8">
              <p className="font-display text-[40px] font-extrabold leading-none tracking-tight text-royal-500">
                {fmt(data.hero.postsShipped)}
              </p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.07em] text-ink-500">
                posts shipped
              </p>
              {data.wow && (
                <div className="mt-2.5">
                  <DeltaPill
                    delta={data.wow.posts.delta}
                    pctChange={data.wow.posts.pctChange}
                  />
                </div>
              )}
            </div>
            <div className="border-r border-bone-200 px-8 py-6">
              <p className="font-display text-[40px] font-extrabold leading-none tracking-tight text-royal-500">
                {compact(data.hero.totalViews)}
              </p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.07em] text-ink-500">
                total views
              </p>
              {data.wow && (
                <div className="mt-2.5">
                  <DeltaPill
                    delta={data.wow.views.delta}
                    pctChange={data.wow.views.pctChange}
                  />
                </div>
              )}
            </div>
            <div className="border-r border-bone-200 px-8 py-6">
              <p className="font-display text-[40px] font-extrabold leading-none tracking-tight text-royal-500">
                {pct(data.hero.engagementRate)}
              </p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.07em] text-ink-500">
                engagement rate
              </p>
              {data.wow && (
                <div className="mt-2.5">
                  <DeltaPill
                    delta={data.wow.engagements.delta}
                    pctChange={data.wow.engagements.pctChange}
                  />
                </div>
              )}
            </div>
            <div className="py-6 pl-8">
              <p className="font-display text-[40px] font-extrabold leading-none tracking-tight text-royal-500">
                {fmt(data.hero.viralPosts)}
              </p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.07em] text-ink-500">
                viral posts
              </p>
              {data.wow && (
                <div className="mt-2.5">
                  <DeltaPill
                    delta={data.wow.viralPosts.delta}
                    pctChange={data.wow.viralPosts.pctChange}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trend */}
        <SectionCard title="Views over time" hint="cumulative">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="rv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EE2324" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EE2324" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9A9AA3" }} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#9A9AA3" }} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [`${fmt(Number(value))} views`, ""]}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#EE2324"
                  fill="url(#rv)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">No trend data yet.</p>
          )}
        </SectionCard>

        {/* Platform leaderboard */}
        <SectionCard title="Platform leaderboard">
          <div className="space-y-3">
            {data.platforms.map((p) => {
              const isLeader = p.platform === data.leaderPlatform;
              return (
                <div
                  key={p.platform}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    isLeader
                      ? "border-royal-200 bg-royal-100"
                      : "border-bone-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-display text-[15px] font-bold lowercase text-ink-900">
                      {platformLabel(p.platform)}
                    </span>
                    {isLeader && (
                      <span className="rounded-full bg-royal-500 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-white">
                        Leader
                      </span>
                    )}
                  </div>
                  <div className="flex gap-6 text-right">
                    <div>
                      <p className="font-display text-[15px] font-bold text-ink-900">
                        {compact(p.views)}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.07em] text-ink-300">
                        views
                      </p>
                    </div>
                    <div>
                      <p className="font-display text-[15px] font-bold text-ink-900">
                        {pct(p.engagementRate)}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.07em] text-ink-300">
                        eng rate
                      </p>
                    </div>
                    <div>
                      <p className="font-display text-[15px] font-bold text-ink-900">
                        {fmt(p.posts)}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.07em] text-ink-300">
                        posts
                      </p>
                    </div>
                    <div>
                      <p className="font-display text-[15px] font-bold text-ink-900">
                        {compact(p.viewsPerPost)}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.07em] text-ink-300">
                        views/post
                      </p>
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
            <p className="mt-3 font-mono text-[11px] text-ink-500">
              Lagging:{" "}
              <span className="font-medium text-ink-700">
                {platformLabel(data.underperformingPlatform)}
              </span>{" "}
              — lowest reach this period.
            </p>
          )}
        </SectionCard>

        {/* Top viral posts */}
        <SectionCard title="Top performing posts" hint="by views">
          <div className="space-y-2">
            {data.topViralPosts.map((post, idx) => (
              <a
                key={post.id}
                href={post.link}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-lg border border-bone-200 bg-white px-3 py-2.5 transition-colors hover:border-royal-200 hover:bg-royal-100"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bone-200 font-mono text-[11px] text-ink-500">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[14px] font-semibold text-ink-900">
                    {post.caption || "Untitled"}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-300">
                    {post.creatorName} · @{post.creatorHandle} ·{" "}
                    {platformLabel(post.platform)} ·{" "}
                    {format(new Date(post.postedAt), "MMM d")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-[15px] font-bold text-ink-900">
                    {compact(post.views)}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-300">
                    {pct(post.engagementRate)} eng
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-ink-300 group-hover:text-royal-500" />
              </a>
            ))}
            {data.topViralPosts.length === 0 && (
              <p className="text-sm text-slate-400">No posts yet.</p>
            )}
          </div>
        </SectionCard>

        {/* Top captions */}
        {data.topCaptions.length > 0 && (
          <SectionCard title="Top captions" hint="highest engagement">
            <div className="space-y-3">
              {data.topCaptions.map((post) => (
                <a
                  key={post.id}
                  href={post.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group block rounded-lg border border-bone-200 bg-white p-3 transition-colors hover:border-royal-200 hover:bg-royal-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-[14px] text-ink-900">
                      {post.caption}
                    </p>
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-ink-300 group-hover:text-royal-500" />
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-ink-300">
                    {post.creatorName} · @{post.creatorHandle} ·{" "}
                    {platformLabel(post.platform)} · {pct(post.engagementRate)} engagement ·{" "}
                    {compact(post.views)} views
                  </p>
                </a>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Posting time + caption length */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Best day to post" hint="avg views by weekday">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.postingByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9A9AA3" }} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#9A9AA3" }} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [fmt(Number(value)), "avg views"]}
                />
                <Bar dataKey="avgViews" radius={[4, 4, 0, 0]}>
                  {data.postingByDay.map((d, i) => (
                    <Cell key={i} fill={d.posts > 0 ? "#EE2324" : "#C7D7FB"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Caption length sweet spot" hint="avg views by length">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.captionLength}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#9A9AA3" }} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "#9A9AA3" }} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, _n, item) => [
                    fmt(Number(value)),
                    `${item?.payload?.posts ?? 0} posts`,
                  ]}
                />
                <Bar dataKey="avgViews" fill="#EE2324" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        {/* Per-creator breakdown */}
        <SectionCard title="Creator breakdown">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bone-200 text-left">
                  <th className="pb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.07em] text-ink-300">
                    Creator
                  </th>
                  <th className="pb-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.07em] text-ink-300">
                    Posts
                  </th>
                  <th className="pb-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.07em] text-ink-300">
                    Views
                  </th>
                  <th className="pb-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.07em] text-ink-300">
                    Eng rate
                  </th>
                  <th className="pb-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.07em] text-ink-300">
                    Best post
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.creators.map((c) => (
                  <tr key={c.creatorId} className="border-b border-bone-200">
                    <td className="py-3">
                      <p className="font-display text-[14px] font-semibold text-ink-900">
                        {c.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-300">
                        @{c.handle}
                      </p>
                    </td>
                    <td className="py-3 text-right font-display text-[14px] font-bold text-ink-900">
                      {fmt(c.posts)}
                    </td>
                    <td className="py-3 text-right font-display text-[14px] font-bold text-ink-900">
                      {compact(c.views)}
                    </td>
                    <td className="py-3 text-right font-display text-[14px] font-bold text-ink-900">
                      {pct(c.engagementRate)}
                    </td>
                    <td className="py-3 text-right font-display text-[14px] font-bold text-ink-900">
                      {compact(c.bestPostViews)}
                    </td>
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

        {/* Footer strip */}
        <div
          className="flex items-center justify-between rounded-2xl px-12 py-6"
          style={ROYAL_SURFACE}
        >
          <BrandMark tone="light" size="sm" />
          <span className="font-mono text-[11px] tracking-[0.03em] text-white/40">
            {format(new Date(data.generatedAt), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
      </div>
    </div>
  );
}
