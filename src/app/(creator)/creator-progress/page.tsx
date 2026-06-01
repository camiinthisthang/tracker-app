import { startOfWeek, addDays, format, isAfter, isBefore } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { CreatorWeeklyProgress } from "@/components/creators/creator-weekly-progress";
import {
  WeekSelector,
  type WeekOption,
} from "@/components/campaigns/week-selector";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEK_OPTS = { weekStartsOn: 1 as const };

function toISODate(d: Date): string {
  // Local-date ISO so a Monday picked in a west-of-UTC zone doesn't shift to
  // Sunday in the URL.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function listWeeks(firstDate: Date, lastDate: Date): Date[] {
  const firstMonday = startOfWeek(firstDate, WEEK_OPTS);
  const lastMonday = startOfWeek(lastDate, WEEK_OPTS);
  const weeks: Date[] = [];
  let cursor = firstMonday;
  while (!isAfter(cursor, lastMonday)) {
    weeks.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export default async function CreatorProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await getRequiredSession();
  const creatorId = session.user.creatorId;
  const { week: weekParam } = await searchParams;

  if (!creatorId) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Weekly progress</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your creator profile isn&apos;t linked to an account yet.
        </p>
      </div>
    );
  }

  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: {
      campaignCreators: {
        where: { isActive: true },
        include: {
          campaign: {
            select: { id: true, isActive: true, startDate: true, endDate: true },
          },
        },
      },
    },
  });

  if (!creator) {
    return <p className="text-sm text-slate-400">Creator not found</p>;
  }

  const activeCCs = creator.campaignCreators.filter(
    (cc) => cc.campaign.isActive
  );

  // Window: from the earliest active campaign start to the latest active
  // campaign end (capped at today). If no active campaigns, fall back to the
  // last 8 weeks so the page still renders something useful.
  const now = new Date();
  let firstDate: Date;
  let lastDate: Date;
  if (activeCCs.length > 0) {
    firstDate = activeCCs.reduce(
      (min, cc) => (isBefore(cc.campaign.startDate, min) ? cc.campaign.startDate : min),
      activeCCs[0].campaign.startDate
    );
    const latestEnd = activeCCs.reduce(
      (max, cc) => (isAfter(cc.campaign.endDate, max) ? cc.campaign.endDate : max),
      activeCCs[0].campaign.endDate
    );
    lastDate = isBefore(now, latestEnd) ? now : latestEnd;
  } else {
    firstDate = addDays(now, -7 * 8);
    lastDate = now;
  }

  const weekStarts = listWeeks(firstDate, lastDate);
  const currentWeekStart = startOfWeek(now, WEEK_OPTS);
  const currentISO = toISODate(currentWeekStart);

  const fallback =
    weekStarts.find((w) => toISODate(w) === currentISO) ??
    weekStarts[weekStarts.length - 1] ??
    currentWeekStart;
  const selectedWeekStart =
    weekStarts.find((w) => toISODate(w) === weekParam) ?? fallback;
  const selectedWeekEnd = addDays(selectedWeekStart, 7);
  const selectedISO = toISODate(selectedWeekStart);

  const weeklyTarget = activeCCs.reduce((sum, cc) => {
    const fromGoal = cc.monthlyPostGoal != null ? cc.monthlyPostGoal / 4 : null;
    return sum + (fromGoal ?? cc.videosPerDay * 5);
  }, 0);
  const dailyTarget = weeklyTarget / DAY_LABELS.length;

  const weekPosts = await prisma.post.findMany({
    where: {
      creatorId,
      postedAt: { gte: selectedWeekStart, lt: selectedWeekEnd },
    },
    select: { postedAt: true },
  });

  const postsPerDay = DAY_LABELS.map((label, i) => {
    const dayStart = addDays(selectedWeekStart, i);
    const dayEnd = addDays(dayStart, 1);
    const count = weekPosts.filter(
      (p) => p.postedAt >= dayStart && p.postedAt < dayEnd
    ).length;
    return { day: label, count };
  });

  const options: WeekOption[] = [...weekStarts].reverse().map((w) => {
    const end = addDays(w, 6);
    return {
      value: toISODate(w),
      label: `${format(w, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
      tag: toISODate(w) === currentISO ? "this week" : undefined,
    };
  });

  const subtitleSuffix = selectedISO === currentISO ? " · this week" : "";

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Weekly progress
          </h1>
          <p className="text-xs text-slate-400">
            {format(selectedWeekStart, "MMM d")} –{" "}
            {format(addDays(selectedWeekStart, 6), "MMM d, yyyy")}
            {subtitleSuffix}
          </p>
        </div>
        <WeekSelector weeks={options} current={selectedISO} />
      </div>
      <CreatorWeeklyProgress
        postsThisWeek={weekPosts.length}
        weeklyTarget={weeklyTarget}
        postsPerDay={postsPerDay}
        dailyTarget={dailyTarget}
      />
    </div>
  );
}
