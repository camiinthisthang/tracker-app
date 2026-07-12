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
  const priorStart = subDays(week.start, 28);

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
        days: new Set(),
      };
      byCreator.set(p.creatorId, agg);
    }
    agg.posts++;
    agg.views += p.views;
    agg.engagements += p.likes + p.comments + p.shares + p.saves;
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

  const topPerformer = aggs.reduce<Agg | null>(
    (best, a) => (a.views > (best?.views ?? 0) ? a : best),
    null
  );

  let mostImproved: { agg: Agg; pct: number; priorAvg: number } | null = null;
  for (const a of aggs) {
    const prior = priorByCreator.get(a.creator.id);
    if (!prior || prior.posts < minPriorPosts || prior.views === 0) continue;
    const priorAvg = prior.views / prior.posts;
    const weekAvg = a.views / a.posts;
    const pct = (weekAvg / priorAvg - 1) * 100;
    if (pct > 0 && (!mostImproved || pct > mostImproved.pct)) {
      mostImproved = { agg: a, pct, priorAvg };
    }
  }

  let mostEngaged: { agg: Agg; rate: number } | null = null;
  for (const a of aggs) {
    if (a.views < minEngagedViews) continue;
    const rate = (a.engagements / a.views) * 100;
    if (!mostEngaged || rate > mostEngaged.rate) mostEngaged = { agg: a, rate };
  }

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

  const mostConsistent = aggs.reduce<Agg | null>((best, a) => {
    if (!best) return a;
    if (a.days.size !== best.days.size)
      return a.days.size > best.days.size ? a : best;
    return a.posts > best.posts ? a : best;
  }, null);

  const cards: Shoutout[] = [
    {
      title: "Top performer",
      tooltip: "Most total views on posts published this week",
      icon: Trophy,
      creator: topPerformer?.creator ?? null,
      stat: topPerformer ? `${topPerformer.views.toLocaleString()} views` : "",
      detail: topPerformer
        ? `across ${topPerformer.posts} post${topPerformer.posts === 1 ? "" : "s"}`
        : "No posts this week",
    },
    {
      title: "Most improved",
      tooltip: `Biggest % gain in average views vs their prior 4-week average — needs ${minPriorPosts}+ posts in that window to qualify (adjustable in Settings)`,
      icon: TrendingUp,
      creator: mostImproved?.agg.creator ?? null,
      stat: mostImproved ? `+${Math.round(mostImproved.pct)}% avg views` : "",
      positive: true,
      detail: mostImproved
        ? `${Math.round(mostImproved.agg.views / mostImproved.agg.posts).toLocaleString()} vs ${Math.round(mostImproved.priorAvg).toLocaleString()} prior 4-week avg`
        : "Needs posting history to compare",
    },
    {
      title: "Most engaged",
      tooltip: `Highest (likes + comments + shares + saves) ÷ views this week — needs ${minEngagedViews}+ views to qualify (adjustable in Settings)`,
      icon: HeartHandshake,
      creator: mostEngaged?.agg.creator ?? null,
      stat: mostEngaged ? `${mostEngaged.rate.toFixed(1)}% engagement` : "",
      detail: mostEngaged
        ? `${mostEngaged.agg.engagements.toLocaleString()} interactions / ${mostEngaged.agg.views.toLocaleString()} views`
        : `Needs ${minEngagedViews}+ views to qualify`,
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
        ? `${mostConsistent.posts} post${mostConsistent.posts === 1 ? "" : "s"} this week`
        : "No posts this week",
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
                <p className="truncate text-xs text-slate-400">{card.detail}</p>
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
