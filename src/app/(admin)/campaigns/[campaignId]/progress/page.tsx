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
import {
  ContractTracker,
  type ContractCreatorRow,
  type ContractWeek,
} from "@/components/campaigns/contract-tracker";
import { goalPlatformFor } from "@/lib/social/goal-counting";

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

/**
 * Reads a stored date's calendar day (its UTC components) as a local-midnight
 * Date. Campaign start/end are saved as midnight UTC, so in a west-of-UTC
 * server timezone they read back as the *previous* day — which pushed Week 1 a
 * week early (e.g. a May 25 Monday start became May 18) and left it empty.
 */
function calendarDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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

  const weekStarts = listCampaignWeeks(
    calendarDate(campaign.startDate),
    calendarDate(campaign.endDate)
  );
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

  // Pull platform too — we filter per-creator by their goal platform so
  // cross-posts on the other platform don't double-count.
  const weekPosts = await prisma.post.findMany({
    where: {
      campaignId,
      postedAt: { gte: selectedWeekStart, lt: selectedWeekEnd },
    },
    select: { creatorId: true, postedAt: true, platform: true },
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

    const goalPlatform = goalPlatformFor(cc.creator);
    const creatorPosts = weekPosts.filter(
      (p) => p.creatorId === cc.creatorId && p.platform === goalPlatform
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
      isActive: cc.isActive,
      videosPerDay: dailyTarget,
      weeklyTarget,
      postsThisWeek: creatorPosts.length,
      postsPerDay,
    };
  });

  // ── Contract Tracker: whole-campaign per-platform delivery + weekly split ──
  // Unlike the rings (which dedupe cross-posts to one canonical platform), the
  // tracker counts raw TikTok and Instagram posts separately — contracts are
  // split per platform, so each platform's deliverables count on their own.
  const trackerStart = weekStarts[0] ?? currentWeekStart;
  const trackerEnd = addDays(weekStarts[weekStarts.length - 1] ?? currentWeekStart, 7);

  const allPosts = await prisma.post.findMany({
    where: {
      campaignId,
      postedAt: { gte: trackerStart, lt: trackerEnd },
    },
    select: { creatorId: true, postedAt: true, platform: true },
  });

  const weekColumns: ContractWeek[] = weekStarts.map((w, i) => ({
    key: toISODate(w),
    label: `Week ${i + 1}`,
    range: `${format(w, "MMM d")} – ${format(addDays(w, 6), "MMM d, yyyy")}`,
    isCurrent: toISODate(w) === currentISO,
  }));

  // Fraction of a window elapsed, clamped 0–1.
  const nowMs = new Date().getTime();
  const fractionOf = (start: Date, end: Date) => {
    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = nowMs - start.getTime();
    return totalMs > 0 ? Math.min(Math.max(elapsedMs / totalMs, 0), 1) : 1;
  };

  const contractRows: ContractCreatorRow[] = campaign.campaignCreators.map((cc) => {
    // This creator's contract window — their own dates when set, the campaign
    // window otherwise. Posted counts, weekly cells, and the pace flag are
    // all measured against it, so warm-up posts before a contract start
    // don't count and a mid-campaign signer isn't paced against time they
    // weren't contracted for.
    const winStart = cc.contractStart ?? campaign.startDate;
    const winEndRaw = cc.contractEnd ?? campaign.endDate;
    const winEnd = addDays(winEndRaw, 1); // inclusive of the end day
    // 1-week warm-up leeway (on by default): expected pace accrues from a
    // week after the window opens, so the ramp-up week can't flag anyone as
    // behind. Posts during warm-up still count as delivered. Skipped when
    // the window is shorter than the warm-up itself.
    const warmupEnd = addDays(winStart, 7);
    const paceStart =
      cc.hasWarmupWeek && warmupEnd < winEndRaw ? warmupEnd : winStart;
    const mine = allPosts.filter(
      (p) =>
        p.creatorId === cc.creatorId &&
        p.postedAt >= winStart &&
        p.postedAt < winEnd
    );
    const weekly: Record<string, { tiktok: number; instagram: number }> = {};
    for (const w of weekStarts) {
      weekly[toISODate(w)] = { tiktok: 0, instagram: 0 };
    }
    let postedTiktok = 0;
    let postedInstagram = 0;
    for (const p of mine) {
      const weekKey = toISODate(startOfWeek(p.postedAt, WEEK_OPTS));
      const bucket = weekly[weekKey];
      if (p.platform === "INSTAGRAM") {
        postedInstagram++;
        if (bucket) bucket.instagram++;
      } else if (p.platform === "TIKTOK") {
        postedTiktok++;
        if (bucket) bucket.tiktok++;
      }
    }
    return {
      creatorId: cc.creatorId,
      creatorName: cc.creator.name,
      creatorHandle: cc.creator.handle,
      isActive: cc.isActive,
      contractedTiktok: cc.contractedTiktok,
      contractedInstagram: cc.contractedInstagram,
      monthlyRate: cc.monthlyRate != null ? Number(cc.monthlyRate) : null,
      contractStart: cc.contractStart ? toISODate(calendarDate(cc.contractStart)) : null,
      contractEnd: cc.contractEnd ? toISODate(calendarDate(cc.contractEnd)) : null,
      hasWarmupWeek: cc.hasWarmupWeek,
      elapsedFraction: fractionOf(paceStart, winEndRaw),
      postedTiktok,
      postedInstagram,
      weekly,
    };
  });

  // Fraction of the campaign window elapsed, for the all-creators totals row.
  const elapsedFraction = fractionOf(campaign.startDate, campaign.endDate);

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
      <ContractTracker
        campaignId={campaign.id}
        rows={contractRows}
        weeks={weekColumns}
        elapsedFraction={elapsedFraction}
      />
    </div>
  );
}
