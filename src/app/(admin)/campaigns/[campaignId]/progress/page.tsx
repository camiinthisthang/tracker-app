import { notFound } from "next/navigation";
import { startOfWeek, addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import {
  CreatorProgressSection,
  type CreatorProgress,
} from "@/components/campaigns/creator-progress";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default async function CampaignProgressPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...campaignVisibilityWhere(session) },
    include: {
      campaignCreators: { include: { creator: true } },
    },
  });

  if (!campaign) notFound();

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);

  const weekPosts = await prisma.post.findMany({
    where: {
      campaignId,
      postedAt: { gte: weekStart, lt: weekEnd },
    },
    select: { creatorId: true, postedAt: true },
  });

  const weeklyTarget = campaign.weeklyPostTarget;
  const dailyTarget = weeklyTarget / DAY_LABELS.length;

  const progresses: CreatorProgress[] = campaign.campaignCreators.map((cc) => {
    const creatorPosts = weekPosts.filter(
      (p) => p.creatorId === cc.creatorId
    );

    const postsPerDay = DAY_LABELS.map((label, i) => {
      const dayStart = addDays(weekStart, i);
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

  return (
    <div>
      <CreatorProgressSection
        progresses={progresses}
        campaignId={campaign.id}
        previewOnly={false}
      />
    </div>
  );
}
