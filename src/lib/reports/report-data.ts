import { prisma } from "@/lib/prisma";
import type { Platform } from "@/generated/prisma/client";

/**
 * Phase 1 client-report computation. Everything here is derived from data we
 * already scrape (Post + CampaignDailyMetric) — no content-understanding layer
 * (hooks / formats / themes); those are Phase 2 (AI classification).
 *
 * A report is scoped either to a single campaign or to an entire client team
 * (aggregating across all of that team's campaigns).
 */

export type ReportScope =
  | { type: "campaign"; campaignId: string }
  | { type: "client"; teamId: string };

/** Engagement = the actions a viewer can take. IG never reports shares/saves
 *  (always 0) — that's a platform limitation, not missing data. Engagement
 *  rate is engagements / views, the standard rate for view-based short video. */
function engagements(p: {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}): number {
  return p.likes + p.comments + p.shares + p.saves;
}

function rate(engagements: number, views: number): number {
  return views > 0 ? engagements / views : 0;
}

type PostRow = {
  id: string;
  platform: Platform;
  title: string | null;
  link: string;
  thumbnailUrl: string | null;
  postedAt: Date;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  creatorId: string;
  creator: { name: string; handle: string };
};

export interface PlatformStat {
  platform: Platform;
  posts: number;
  views: number;
  engagements: number;
  engagementRate: number;
  viewsPerPost: number;
}

export interface ReportPost {
  id: string;
  platform: Platform;
  caption: string | null;
  link: string;
  thumbnailUrl: string | null;
  postedAt: string;
  views: number;
  engagements: number;
  engagementRate: number;
  creatorName: string;
  creatorHandle: string;
}

export interface CreatorStat {
  creatorId: string;
  name: string;
  handle: string;
  posts: number;
  views: number;
  engagements: number;
  engagementRate: number;
  bestPostViews: number;
  bestPostCaption: string | null;
}

export interface WowDelta {
  thisWeek: number;
  lastWeek: number;
  delta: number;
  pctChange: number | null;
}

export interface ReportData {
  scope: ReportScope;
  title: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  hero: {
    postsShipped: number;
    totalViews: number;
    totalEngagements: number;
    engagementRate: number;
    viralPosts: number;
    viralThreshold: number;
  };
  platforms: PlatformStat[];
  leaderPlatform: Platform | null;
  underperformingPlatform: Platform | null;
  // Cumulative views/engagements over the window. Built from the Post table
  // (bucketed by publish date, then accumulated) so the line ends at the hero
  // totals — not from CampaignDailyMetric, whose rows are cumulative
  // campaign-to-date snapshots keyed by sync date.
  trend: { date: string; views: number; engagements: number }[];
  topViralPosts: ReportPost[];
  topCaptions: ReportPost[];
  creators: CreatorStat[];
  captionLength: { bucket: string; posts: number; avgViews: number; avgEngagementRate: number }[];
  postingByDay: { day: string; posts: number; avgViews: number }[];
  postingByHour: { hour: number; posts: number; avgViews: number }[];
  wow: {
    posts: WowDelta;
    views: WowDelta;
    engagements: WowDelta;
    viralPosts: WowDelta;
  } | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function mkDelta(thisWeek: number, lastWeek: number): WowDelta {
  const delta = thisWeek - lastWeek;
  return {
    thisWeek,
    lastWeek,
    delta,
    pctChange: lastWeek > 0 ? delta / lastWeek : null,
  };
}

function captionSnippet(title: string | null, max = 140): string | null {
  if (!title) return null;
  const t = title.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

const WEEK_MS = 7 * 86_400_000;

/** Parse `?from=YYYY-MM-DD&to=YYYY-MM-DD` into an inclusive UTC report window.
 *  Returns undefined when either bound is missing/invalid (falls back to the
 *  default trailing-week window in computeReport). */
export function parseReportRange(sp: {
  from?: string;
  to?: string;
}): { start: Date; end: Date } | undefined {
  if (!sp.from || !sp.to) return undefined;
  const start = new Date(`${sp.from}T00:00:00.000Z`);
  const end = new Date(`${sp.to}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return undefined;
  }
  if (end < start) return undefined;
  return { start, end };
}

export async function computeReport(
  scope: ReportScope,
  // Reporting window. When absent, `defaultWindow` picks the fallback:
  // "full" covers everything the tracker counts for the scope (campaign
  // start or earliest post, whichever is first, through now) — the
  // client-facing default; "week" is the trailing 7 days.
  range?: { start: Date; end: Date },
  opts?: { defaultWindow?: "week" | "full" }
): Promise<ReportData> {
  // Resolve scope → the set of campaigns + display title + campaign bounds.
  let title: string;
  let subtitle: string;
  let campaignIds: string[];
  let campaignEnd: Date;
  let campaignStart: Date | null = null;

  if (scope.type === "campaign") {
    const campaign = await prisma.campaign.findUnique({
      where: { id: scope.campaignId },
      include: { team: { select: { name: true } } },
    });
    if (!campaign) throw new Error(`Campaign ${scope.campaignId} not found`);
    title = campaign.name;
    subtitle = campaign.team.name;
    campaignIds = [campaign.id];
    campaignEnd = campaign.endDate;
    campaignStart = campaign.startDate;
  } else {
    const team = await prisma.team.findUnique({
      where: { id: scope.teamId },
      select: { name: true },
    });
    const campaigns = await prisma.campaign.findMany({
      where: { teamId: scope.teamId },
      select: { id: true, startDate: true, endDate: true, isActive: true },
    });
    if (!team) throw new Error(`Team ${scope.teamId} not found`);
    title = team.name;
    // Subtitle counts only currently-live campaigns so a client's lifetime of
    // wrapped campaigns doesn't inflate the number. Data below still aggregates
    // across the full window.
    const activeCount = campaigns.filter((c) => c.isActive).length;
    subtitle = `${activeCount} campaign${activeCount === 1 ? "" : "s"}`;
    campaignIds = campaigns.map((c) => c.id);
    campaignEnd = campaigns.length
      ? new Date(Math.max(...campaigns.map((c) => c.endDate.getTime())))
      : new Date();
    campaignStart = campaigns.length
      ? new Date(Math.min(...campaigns.map((c) => c.startDate.getTime())))
      : null;
  }

  const allPosts: PostRow[] =
    campaignIds.length === 0
      ? []
      : await prisma.post.findMany({
          where: { campaignId: { in: campaignIds } },
          select: {
            id: true,
            platform: true,
            title: true,
            link: true,
            thumbnailUrl: true,
            postedAt: true,
            views: true,
            likes: true,
            comments: true,
            shares: true,
            saves: true,
            creatorId: true,
            creator: { select: { name: true, handle: true } },
          },
        });

  // Reporting window: explicit range if given, else per defaultWindow.
  // "full" starts at the campaign start OR the earliest tracked post,
  // whichever is first — posts published before the campaign window are
  // deliberately kept (per Jacqueline, 2026-07-15: a pre-campaign viral video
  // still counts), so a full-campaign report must not clip them — and runs
  // through now. "week" (trailing 7 days) anchors its end to
  // min(now, campaignEnd) so a report viewed after a campaign wraps shows its
  // final week instead of an empty trailing window.
  let windowEnd: Date;
  let windowStart: Date;
  if (range) {
    windowEnd = range.end;
    windowStart = range.start;
  } else if (opts?.defaultWindow === "full") {
    windowEnd = new Date();
    const earliestPost = allPosts.length
      ? Math.min(...allPosts.map((p) => p.postedAt.getTime()))
      : Date.now();
    windowStart = new Date(
      Math.min(earliestPost, campaignStart?.getTime() ?? Infinity)
    );
  } else {
    windowEnd = new Date(Math.min(Date.now(), campaignEnd.getTime()));
    windowStart = new Date(windowEnd.getTime() - WEEK_MS);
  }
  // Previous comparison period is the same length immediately before the window
  // (so a month compares to the prior month, a week to the prior week).
  const windowMs = Math.max(windowEnd.getTime() - windowStart.getTime(), WEEK_MS);
  const prevWindowStart = new Date(windowStart.getTime() - windowMs);
  const inWindow = (d: Date) => d >= windowStart && d <= windowEnd;

  // The report body covers the reporting window; allPosts is kept for the
  // week-over-week comparison (this window vs. the one before it).
  const posts = allPosts.filter((p) => inWindow(p.postedAt));

  // ── Hero ──────────────────────────────────────────────────────────────
  const totalViews = posts.reduce((s, p) => s + p.views, 0);
  const totalEngagements = posts.reduce((s, p) => s + engagements(p), 0);
  const med = median(posts.map((p) => p.views));
  const mean = posts.length ? totalViews / posts.length : 0;
  // Viral = above 3× the median view count. When the median is 0 (lots of
  // brand-new / zero-view posts) fall back to 3× the mean so the threshold
  // stays meaningful; if there's no signal at all, nothing is viral.
  const viralThreshold = med > 0 ? med * 3 : mean > 0 ? mean * 3 : Infinity;
  const viralPosts = posts.filter((p) => p.views >= viralThreshold).length;

  // ── Platform leaderboard ─────────────────────────────────────────────
  const platformMap = new Map<Platform, PlatformStat>();
  for (const p of posts) {
    const cur =
      platformMap.get(p.platform) ??
      ({
        platform: p.platform,
        posts: 0,
        views: 0,
        engagements: 0,
        engagementRate: 0,
        viewsPerPost: 0,
      } satisfies PlatformStat);
    cur.posts += 1;
    cur.views += p.views;
    cur.engagements += engagements(p);
    platformMap.set(p.platform, cur);
  }
  const platforms = Array.from(platformMap.values()).map((s) => ({
    ...s,
    engagementRate: rate(s.engagements, s.views),
    viewsPerPost: s.posts ? Math.round(s.views / s.posts) : 0,
  }));
  platforms.sort((a, b) => b.views - a.views);
  const leaderPlatform = platforms[0]?.platform ?? null;
  const underperformingPlatform =
    platforms.length > 1 ? platforms[platforms.length - 1].platform : null;

  // ── Top viral posts + top captions by engagement ─────────────────────
  const toReportPost = (p: PostRow): ReportPost => {
    const eng = engagements(p);
    return {
      id: p.id,
      platform: p.platform,
      caption: captionSnippet(p.title),
      link: p.link,
      thumbnailUrl: p.thumbnailUrl,
      postedAt: p.postedAt.toISOString(),
      views: p.views,
      engagements: eng,
      engagementRate: rate(eng, p.views),
      creatorName: p.creator.name,
      creatorHandle: p.creator.handle,
    };
  };

  const topViralPosts = [...posts]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
    .map(toReportPost);

  // Rank captions by engagement rate, but require a minimum view floor so a
  // 2-view / 1-like post doesn't show as "100% engagement". Floor = 10% of
  // the mean (or a hard 50 views), whichever is higher.
  const captionViewFloor = Math.max(50, Math.round(mean * 0.1));
  const topCaptions = posts
    .filter((p) => p.title && p.title.trim() && p.views >= captionViewFloor)
    .map(toReportPost)
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 3);

  // ── Per-creator breakdown ─────────────────────────────────────────────
  const creatorMap = new Map<string, CreatorStat>();
  for (const p of posts) {
    const cur =
      creatorMap.get(p.creatorId) ??
      ({
        creatorId: p.creatorId,
        name: p.creator.name,
        handle: p.creator.handle,
        posts: 0,
        views: 0,
        engagements: 0,
        engagementRate: 0,
        bestPostViews: 0,
        bestPostCaption: null,
      } satisfies CreatorStat);
    cur.posts += 1;
    cur.views += p.views;
    cur.engagements += engagements(p);
    if (p.views >= cur.bestPostViews) {
      cur.bestPostViews = p.views;
      cur.bestPostCaption = captionSnippet(p.title, 80);
    }
    creatorMap.set(p.creatorId, cur);
  }
  const creators = Array.from(creatorMap.values())
    .map((c) => ({ ...c, engagementRate: rate(c.engagements, c.views) }))
    .sort((a, b) => b.views - a.views);

  // ── Caption length sweet spot ─────────────────────────────────────────
  const lengthBuckets = [
    { bucket: "0–50", min: 0, max: 50 },
    { bucket: "51–100", min: 51, max: 100 },
    { bucket: "101–150", min: 101, max: 150 },
    { bucket: "151+", min: 151, max: Infinity },
  ];
  const captionLength = lengthBuckets.map((b) => {
    const inBucket = posts.filter((p) => {
      const len = (p.title ?? "").trim().length;
      return len >= b.min && len <= b.max;
    });
    const v = inBucket.reduce((s, p) => s + p.views, 0);
    const e = inBucket.reduce((s, p) => s + engagements(p), 0);
    return {
      bucket: b.bucket,
      posts: inBucket.length,
      avgViews: inBucket.length ? Math.round(v / inBucket.length) : 0,
      avgEngagementRate: rate(e, v),
    };
  });

  // ── Posting time analysis (UTC) ───────────────────────────────────────
  const byDay = DAY_NAMES.map((day, idx) => {
    const inDay = posts.filter((p) => p.postedAt.getUTCDay() === idx);
    const v = inDay.reduce((s, p) => s + p.views, 0);
    return {
      day,
      posts: inDay.length,
      avgViews: inDay.length ? Math.round(v / inDay.length) : 0,
    };
  });
  const byHour = Array.from({ length: 24 }, (_, hour) => {
    const inHour = posts.filter((p) => p.postedAt.getUTCHours() === hour);
    const v = inHour.reduce((s, p) => s + p.views, 0);
    return {
      hour,
      posts: inHour.length,
      avgViews: inHour.length ? Math.round(v / inHour.length) : 0,
    };
  });

  // ── Trend (cumulative views/engagements over the window, from posts) ──
  // Bucket the window's posts by publish day, then accumulate so the line
  // ends exactly at the hero totals (it reconciles with "Total views").
  // Derived from the Post table — not CampaignDailyMetric, whose rows are
  // cumulative campaign-to-date snapshots keyed by sync date and so can't be
  // read as a per-day series.
  const dayMap = new Map<string, { views: number; engagements: number }>();
  for (const p of posts) {
    const key = p.postedAt.toISOString().slice(0, 10);
    const cur = dayMap.get(key) ?? { views: 0, engagements: 0 };
    cur.views += p.views;
    cur.engagements += engagements(p);
    dayMap.set(key, cur);
  }
  let runningViews = 0;
  let runningEngagements = 0;
  const trend = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => {
      runningViews += v.views;
      runningEngagements += v.engagements;
      return { date, views: runningViews, engagements: runningEngagements };
    });

  // ── Week-over-week: this window vs. the equivalent window before it ────
  // All four deltas come from the Post table so they reconcile with the rest
  // of the report (this period's posts vs. the previous period's posts).
  const postsThisWeek = posts;
  const postsLastWeek = allPosts.filter(
    (p) => p.postedAt >= prevWindowStart && p.postedAt < windowStart
  );
  const sumViews = (rows: PostRow[]) => rows.reduce((s, p) => s + p.views, 0);
  const sumEngagements = (rows: PostRow[]) =>
    rows.reduce((s, p) => s + engagements(p), 0);
  const countViral = (rows: PostRow[]) =>
    rows.filter((p) => p.views >= viralThreshold).length;

  // No comparison when the previous period has nothing in it (e.g. a
  // full-campaign window, whose "previous period" is pre-campaign) — a
  // "+everything vs. nothing" delta reads as noise on a client report.
  const wow = postsLastWeek.length
    ? {
        posts: mkDelta(postsThisWeek.length, postsLastWeek.length),
        views: mkDelta(sumViews(postsThisWeek), sumViews(postsLastWeek)),
        engagements: mkDelta(
          sumEngagements(postsThisWeek),
          sumEngagements(postsLastWeek)
        ),
        viralPosts: mkDelta(countViral(postsThisWeek), countViral(postsLastWeek)),
      }
    : null;

  return {
    scope,
    title,
    subtitle,
    startDate: windowStart.toISOString(),
    endDate: windowEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    hero: {
      postsShipped: posts.length,
      totalViews,
      totalEngagements,
      engagementRate: rate(totalEngagements, totalViews),
      viralPosts,
      viralThreshold: Number.isFinite(viralThreshold)
        ? Math.round(viralThreshold)
        : 0,
    },
    platforms,
    leaderPlatform,
    underperformingPlatform,
    trend,
    topViralPosts,
    topCaptions,
    creators,
    captionLength,
    postingByDay: byDay,
    postingByHour: byHour,
    wow,
  };
}
