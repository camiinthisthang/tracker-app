import { notFound } from "next/navigation";
import { startOfWeek, addDays, format, isAfter, isBefore } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import {
  CreatorProgressSection,
  type CreatorProgress,
} from "@/components/campaigns/creator-progress";
import {
  WeekSelector,
  type WeekOption,
} from "@/components/campaigns/week-selector";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEK_OPTS = { weekStartsOn: 1 as const };

/**
 * Generates the list of week-start (Monday) dates within the campaign window.
 * Caps at the current week — no "view a future week" option, posts can't exist
 * there. The first option is the Monday of the week containing campaign.startDate
 * (so a campaign that starts Tuesday still shows the partial week that contains it).
 */
function listCampaignWeeks(campaignStart: Date, campaignEnd: Date): Date[] {
  const now = new Date();
  const firstMonday = startOfWeek(campaignStart, WEEK_OPTS);
  const lastBoundDate = isBefore(now, campaignEnd) ? now : campaignEnd;
  const lastMonday = startOfWeek(lastBoundDate, WEEK_OPTS);

  const weeks: Date[] = [];
  let cursor = firstMonday;
  while (!isAfter(cursor, lastMonday)) {
    weeks.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function toISODate(d: Date): string {
  // Local-date ISO (YYYY-MM-DD) — avoids the UTC-shift gotcha that
  // d.toISOString() introduces for late-evening dates in west-of-UTC zones.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function CampaignProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;
  const { week: weekParam } = await searchParams;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...campaignVisibilityWhere(session) },
    include: {
      campaignCreators: { include: { creator: true } },
    },
  });

  if (!campaign) notFound();

  const weekStarts = listCampaignWeeks(campaign.startDate, campaign.endDate);
  const currentWeekStart = startOfWeek(new Date(), WEEK_OPTS);
  const currentISO = toISODate(currentWeekStart);

  // Resolve the selected week. If the param is missing or doesn't match any
  // week in the campaign, fall back to the current week if it's in-range,
  // otherwise the most recent campaign week.
  const fallback =
    weekStarts.find((w) => toISODate(w) === currentISO) ??
    weekStarts[weekStarts.length - 1] ??
    currentWeekStart;
  const selectedWeekStart =
    weekStarts.find((w) => toISODate(w) === weekParam) ?? fallback;
  const selectedWeekEnd = addDays(selectedWeekStart, 7);
  const selectedISO = toISODate(selectedWeekStart);

  const weekPosts = await prisma.post.findMany({
    where: {
      campaignId,
      postedAt: { gte: selectedWeekStart, lt: selectedWeekEnd },
    },
    select: { creatorId: true, postedAt: true },
  });

  const progresses: CreatorProgress[] = campaign.campaignCreators.map((cc) => {
    // Per-creator monthly goal wins when set; otherwise fall back to the
    // campaign-level weekly target so creators without an explicit goal still
    // get a sensible ring.
    const weeklyTarget =
      cc.monthlyPostGoal != null
        ? cc.monthlyPostGoal / 4
        : campaign.weeklyPostTarget;
    const dailyTarget = weeklyTarget / DAY_LABELS.length;

    const creatorPosts = weekPosts.filter(
      (p) => p.creatorId === cc.creatorId
    );

    const postsPerDay = DAY_LABELS.map((label, i) => {
      const dayStart = addDays(selectedWeekStart, i);
      const dayEnd = addDays(dayStart, 1);
      const count = creatorPosts.filter(
        (p) => p.postedAt >= dayStart && p.postedAt < dayEnd
      ).length;
      return { day: label, count };
    });

    return {
      creatorId: cc.creatorId,
      creatorName: cc.creator.name,
      creatorHandle: cc.creator.handle,
      videosPerDay: dailyTarget,
      weeklyTarget,
      postsThisWeek: creatorPosts.length,
      postsPerDay,
    };
  });

  // Newest-first in the dropdown so the most recent / current week is on top.
  const options: WeekOption[] = [...weekStarts]
    .reverse()
    .map((w) => {
      const end = addDays(w, 6);
      return {
        value: toISODate(w),
        label: `${format(w, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
        tag: toISODate(w) === currentISO ? "this week" : undefined,
      };
    });

  const subtitle = `${format(selectedWeekStart, "MMM d")} – ${format(
    addDays(selectedWeekStart, 6),
    "MMM d, yyyy"
  )}${selectedISO === currentISO ? " · this week" : ""}`;

  return (
    <div>
      <CreatorProgressSection
        progresses={progresses}
        campaignId={campaign.id}
        previewOnly={false}
        subtitle={subtitle}
        headerRight={<WeekSelector weeks={options} current={selectedISO} />}
      />
    </div>
  );
}
