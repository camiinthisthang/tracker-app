import { prisma } from "@/lib/prisma";
import { addDays, startOfDay, eachDayOfInterval, isBefore } from "date-fns";

/**
 * Auto-generate tasks for all creators in a campaign based on campaign settings.
 * Creates tasks for the next 7 days (or until campaign end date).
 */
export async function generateTasksForCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: {
        where: { isActive: true },
        include: { creator: true },
      },
    },
  });

  if (!campaign) throw new Error("Campaign not found");

  const today = startOfDay(new Date());
  const endDate = isBefore(campaign.endDate, addDays(today, 7))
    ? campaign.endDate
    : addDays(today, 7);

  const days = eachDayOfInterval({ start: today, end: endDate });
  const tasksToCreate: {
    campaignId: string;
    creatorId: string;
    type: "POST_VIDEOS" | "UPLOAD_FOR_REVIEW" | "REVIEW_FEEDBACK" | "RESPOND_TO_COMMENTS";
    title: string;
    dueDate: Date;
  }[] = [];

  for (const cc of campaign.campaignCreators) {
    for (const day of days) {
      // POST_VIDEOS: daily task based on videosPerDay
      if (cc.videosPerDay > 0) {
        tasksToCreate.push({
          campaignId,
          creatorId: cc.creatorId,
          type: "POST_VIDEOS",
          title: `review feedback + post ${cc.videosPerDay} videos`,
          dueDate: day,
        });
      }

      // RESPOND_TO_COMMENTS: daily
      tasksToCreate.push({
        campaignId,
        creatorId: cc.creatorId,
        type: "RESPOND_TO_COMMENTS",
        title: "respond to comments",
        dueDate: day,
      });
    }

    // UPLOAD_FOR_REVIEW: twice per week (Monday and Thursday)
    for (const day of days) {
      const dayOfWeek = day.getDay();
      if (dayOfWeek === 1 || dayOfWeek === 4) {
        const weeklyUploadCount = cc.videosPerDay * 3; // ~3 days worth
        tasksToCreate.push({
          campaignId,
          creatorId: cc.creatorId,
          type: "UPLOAD_FOR_REVIEW",
          title: `upload ${weeklyUploadCount} videos for review`,
          dueDate: day,
        });
      }
    }
  }

  // Batch upsert — skip tasks that already exist for the same creator/campaign/type/date
  let created = 0;
  for (const task of tasksToCreate) {
    const existing = await prisma.task.findFirst({
      where: {
        campaignId: task.campaignId,
        creatorId: task.creatorId,
        type: task.type,
        dueDate: task.dueDate,
      },
    });

    if (!existing) {
      await prisma.task.create({ data: task });
      created++;
    }
  }

  return { created, total: tasksToCreate.length };
}
