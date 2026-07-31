import Link from "next/link";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  TrendingUp,
  Trophy,
  UserPlus,
} from "lucide-react";
import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import type {
  campaignVisibilityWhere,
  creatorVisibilityWhere,
} from "@/lib/visibility";
import { getWeekWindow } from "@/lib/weeks";
import { dashboardUrl, type DashboardParams } from "@/lib/dashboard-url";
import { ATTRIBUTION_ENABLED } from "@/lib/constants";

interface Props {
  campaignWhere: ReturnType<typeof campaignVisibilityWhere>;
  creatorWhere: ReturnType<typeof creatorVisibilityWhere>;
  weekOffset: number;
  params: DashboardParams;
  /** Team whose Settings hold the shoutout qualifying rules. */
  settingsTeamId?: string | null;
}

type CreatorLite = { id: string; name: string; handle: string };

interface Shoutout {
  title: string;
  tooltip: string;
  icon: React.ComponentType<{ className?: string }>;
  creator: CreatorLite | null;
  stat: string;
  detail: string;
  /** Optional second-place line, e.g. "Joe Lemin · 8,120 views". */
  runnerUp?: string | null;
  positive?: boolean;
}

// Fallback minimum sample sizes so one 40-view post can't win "most engaged"
// with a misleading 20% rate — overridable in Settings.
const DEFAULT_MIN_ENGAGED_VIEWS = 500;
const DEFAULT_MIN_PRIOR_POSTS = 3;

export async function WeeklyShoutouts({
  campaignWhere,
  creatorWhere,
  weekOffset,
  params,
  settingsTeamId,
}: Props) {
  const settings = settingsTeamId
    ? await prisma.teamSettings.findUnique({
        where: { teamId: settingsTeamId },
        select: { shoutoutMinViews: true, shoutoutMinPriorPosts: true },
      })
    : null;
  const minEngagedViews = settings?.shoutoutMinViews ?? DEFAULT_MIN_ENGAGED_VIEWS;
  const minPriorPosts = settings?.shoutoutMinPriorPosts ?? DEFAULT_MIN_PRIOR_POSTS;
  const week = getWeekWindow(weekOffset);
  // Most improved compares against the PREVIOUS WEEK (per Jackie,
  // 2026-07-31: consistent week-to-week highlighting, not a 4-week average).
  const priorStart = subDays(week.start, 7);

  const [weekPosts, priorPosts, attributions] = await Promise.all([
    prisma.post.findMany({
      where: {
        campaign: campaignWhere,
        postedAt: { gte: week.start, lt: week.end },
      },
      select: {
        creatorId: true,
        views: true,
        likes: true,
        comments: true,
        shares: true,
        saves: true,
        postedAt: true,
        creator: { select: { id: true, name: true, handle: true } },
      },
    }),
    prisma.post.findMany({
      where: {
        campaign: campaignWhere,
        postedAt: { gte: priorStart, lt: week.start },
      },
      select: { creatorId: true, views: true },
    }),
    ATTRIBUTION_ENABLED
      ? prisma.creatorAttribution.groupBy({
          by: ["creatorId"],
          where: {
            creator: creatorWhere,
            date: { gte: week.start, lt: week.end },
          },
          _sum: { signupCount: true },
        })
      : Promise.resolve([]),
  ]);

  type Agg = {
    creator: CreatorLite;
    posts: number;
    views: number;
    engagements: number;
    likes: number;
    comments: number;
    sharesSaves: number;
    postViews: number[];
    days: Set<string>;
  };
  const byCreator = new Map<string, Agg>();
  for (const p of weekPosts) {
    let agg = byCreator.get(p.creatorId);
    if (!agg) {
      agg = {
        creator: p.creator,
        posts: 0,
        views: 0,
        engagements: 0,
        likes: 0,
        comments: 0,
        sharesSaves: 0,
        postViews: [],
        days: new Set(),
      };
      byCreator.set(p.creatorId, agg);
    }
    agg.posts++;
    agg.views += p.views;
    agg.engagements += p.likes + p.comments + p.shares + p.saves;
    agg.likes += p.likes;
    agg.comments += p.comments;
    agg.sharesSaves += p.shares + p.saves;
    agg.postViews.push(p.views);
    agg.days.add(p.postedAt.toDateString());
  }
  const aggs = [...byCreator.values()];

  const priorByCreator = new Map<string, { posts: number; views: number }>();
  for (const p of priorPosts) {
    const prev = priorByCreator.get(p.creatorId) ?? { posts: 0, views: 0 };
    prev.posts++;
    prev.views += p.views;
    priorByCreator.set(p.creatorId, prev);
  }

  const byViews = [...aggs].sort((a, b) => b.views - a.views);
  const topPerformer = byViews[0] ?? null;
  const topRunnerUp = byViews[1] ?? null;

  // Most improved, with a self-diagnosing empty state: when nobody wins, say
  // exactly which qualifying rule blocked it instead of a vague blank —
  // "why is this empty" should be answerable from the card itself.
  const improved: { agg: Agg; pct: number; priorAvg: number }[] = [];
  let qualifiedForImproved = 0;
  let thinHistoryImproved = 0;
  for (const a of aggs) {
    const prior = priorByCreator.get(a.creator.id);
    if (!prior || prior.views === 0) continue;
    const priorAvg = prior.views / prior.posts;
    const pct = (a.views / a.posts / priorAvg - 1) * 100;
    if (prior.posts < minPriorPosts) {
      if (pct > 0) thinHistoryImproved++;
      continue;
    }
    qualifiedForImproved++;
    if (pct > 0) improved.push({ agg: a, pct, priorAvg });
  }
  improved.sort((a, b) => b.pct - a.pct);
  const mostImproved = improved[0] ?? null;
  const improvedEmptyReason =
    qualifiedForImproved === 0
      ? thinHistoryImproved > 0
        ? `${thinHistoryImproved} creator${thinHistoryImproved === 1 ? " is" : "s are"} up vs last week but under the ${minPriorPosts}-post minimum for last week (set in Settings)`
        : `No creator had ${minPriorPosts}+ tracked posts last week`
      : "No one topped their last-week average yet — this week's posts are still gaining views";

  // Engagement rate only means something on posts with real reach: a creator
  // whose typical post is tiny can rack up friend-likes and top the rate
  // board on likes alone (no comments/shares/saves). So qualify on BOTH the
  // week's total views and the median post's views.
  const medianViews = (xs: number[]) => {
    const sorted = [...xs].sort((x, y) => x - y);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  const engaged: { agg: Agg; rate: number }[] = [];
  for (const a of aggs) {
    if (a.views < minEngagedViews) continue;
    if (medianViews(a.postViews) < minEngagedViews) continue;
    engaged.push({ agg: a, rate: (a.engagements / a.views) * 100 });
  }
  engaged.sort((a, b) => b.rate - a.rate);
  const mostEngaged = engaged[0] ?? null;

  let bestConverter: { creator: CreatorLite; signups: number } | null = null;
  for (const row of attributions) {
    const signups = row._sum.signupCount ?? 0;
    if (signups <= 0 || signups <= (bestConverter?.signups ?? 0)) continue;
    const agg = byCreator.get(row.creatorId);
    const creator =
      agg?.creator ??
      (await prisma.creator.findUnique({
        where: { id: row.creatorId },
        select: { id: true, name: true, handle: true },
      }));
    if (creator) bestConverter = { creator, signups };
  }

  const byConsistency = [...aggs].sort(
    (a, b) => b.days.size - a.days.size || b.posts - a.posts
  );
  const mostConsistent = byConsistency[0] ?? null;
  const consistentRunnerUp = byConsistency[1] ?? null;

  // Which weekdays a creator posted, in Mon–Sun order, e.g. "Mon · Wed · Fri".
  const postedDayLabels = (agg: Agg) => {
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(week.start);
      d.setDate(d.getDate() + i);
      if (agg.days.has(d.toDateString())) {
        labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
      }
    }
    return labels.join(" · ");
  };

  const cards: Shoutout[] = [
    {
      title: "Top performer",
      tooltip: "Most total views on posts published this week",
      icon: Trophy,
      creator: topPerformer?.creator ?? null,
      stat: topPerformer ? `${topPerformer.views.toLocaleString()} views` : "",
      detail: topPerformer
        ? `${topPerformer.posts} post${topPerformer.posts === 1 ? "" : "s"} · avg ${Math.round(topPerformer.views / topPerformer.posts).toLocaleString()}/post`
        : "No posts this week",
      runnerUp:
        topRunnerUp && topRunnerUp.views > 0
          ? `${topRunnerUp.creator.name} · ${topRunnerUp.views.toLocaleString()} views`
          : null,
    },
    {
      title: "Most improved",
      tooltip: `Biggest % gain in average views per post vs LAST week — needs ${minPriorPosts}+ posts last week to qualify (adjustable in Settings)`,
      icon: TrendingUp,
      creator: mostImproved?.agg.creator ?? null,
      stat: mostImproved ? `+${Math.round(mostImproved.pct)}% avg views` : "",
      positive: true,
      detail: mostImproved
        ? `${Math.round(mostImproved.agg.views / mostImproved.agg.posts).toLocaleString()} vs ${Math.round(mostImproved.priorAvg).toLocaleString()} avg last week`
        : improvedEmptyReason,
      runnerUp: improved[1]
        ? `${improved[1].agg.creator.name} · +${Math.round(improved[1].pct)}%`
        : null,
    },
    {
      title: "Most engaged",
      tooltip: `Highest (likes + comments + shares + saves) ÷ views this week — needs ${minEngagedViews}+ total views and a typical (median) post of ${minEngagedViews}+ views to qualify (adjustable in Settings)`,
      icon: HeartHandshake,
      creator: mostEngaged?.agg.creator ?? null,
      stat: mostEngaged ? `${mostEngaged.rate.toFixed(1)}% engagement` : "",
      detail: mostEngaged
        ? `${mostEngaged.agg.likes.toLocaleString()} likes · ${mostEngaged.agg.comments.toLocaleString()} comments · ${mostEngaged.agg.sharesSaves.toLocaleString()} shares+saves / ${mostEngaged.agg.views.toLocaleString()} views`
        : `Needs ${minEngagedViews}+ views to qualify`,
      runnerUp: engaged[1]
        ? `${engaged[1].agg.creator.name} · ${engaged[1].rate.toFixed(1)}%`
        : null,
    },
    ...(ATTRIBUTION_ENABLED
      ? [
          {
            title: "Best converter",
            tooltip: "Most attributed signups this week (PostHog)",
            icon: UserPlus,
            creator: bestConverter?.creator ?? null,
            stat: bestConverter
              ? `${bestConverter.signups.toLocaleString()} signups`
              : "",
            detail: bestConverter
              ? "attributed via PostHog"
              : "No attributed signups this week",
          },
        ]
      : []),
    {
      title: "Most consistent",
      tooltip: "Posted on the most distinct days this week (ties break on post count)",
      icon: CalendarCheck,
      creator: mostConsistent?.creator ?? null,
      stat: mostConsistent
        ? `${mostConsistent.days.size} day${mostConsistent.days.size === 1 ? "" : "s"} posting`
        : "",
      detail: mostConsistent
        ? `${mostConsistent.posts} post${mostConsistent.posts === 1 ? "" : "s"} · ${postedDayLabels(mostConsistent)}`
        : "No posts this week",
      runnerUp:
        consistentRunnerUp && consistentRunnerUp.days.size > 0
          ? `${consistentRunnerUp.creator.name} · ${consistentRunnerUp.days.size} day${consistentRunnerUp.days.size === 1 ? "" : "s"}`
          : null,
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Weekly Shoutouts
          </h3>
          <p className="text-xs text-slate-400">
            {week.label} · {week.range}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={dashboardUrl({ ...params, week: weekOffset + 1 })}
            className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-24 text-center text-xs font-medium text-slate-600">
            {week.label}
          </span>
          {weekOffset > 0 ? (
            <Link
              href={dashboardUrl({ ...params, week: weekOffset - 1 })}
              className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="rounded-md border border-slate-100 p-1 text-slate-200">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
      <div
        className={`mt-3 grid gap-3 sm:grid-cols-2 ${ATTRIBUTION_ENABLED ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
      >
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-lg border border-slate-100 bg-slate-50 p-3"
          >
            <div
              title={card.tooltip}
              className="flex cursor-help items-center gap-1.5 text-xs font-medium text-slate-500"
            >
              <card.icon className="h-3.5 w-3.5 text-blue-500" />
              {card.title}
            </div>
            {card.creator ? (
              <>
                <Link
                  href={`/creators/${card.creator.id}`}
                  className="mt-2 block truncate text-sm font-semibold text-slate-800 hover:text-blue-600"
                >
                  {card.creator.name}
                </Link>
                <p className="truncate text-xs text-slate-400">
                  @{card.creator.handle}
                </p>
                <p
                  className={`mt-1 text-sm font-medium ${
                    card.positive ? "text-emerald-600" : "text-slate-700"
                  }`}
                >
                  {card.stat}
                </p>
                <p
                  title={card.detail}
                  className="truncate text-xs text-slate-400"
                >
                  {card.detail}
                </p>
                {card.runnerUp && (
                  <p
                    title={`Runner-up: ${card.runnerUp}`}
                    className="mt-1 truncate border-t border-slate-100 pt-1 text-[11px] text-slate-400"
                  >
                    2nd · {card.runnerUp}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-400">{card.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
