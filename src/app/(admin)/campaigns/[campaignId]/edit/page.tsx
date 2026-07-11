import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { campaignVisibilityWhere, creatorVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { DeleteCampaignDangerZone } from "@/components/campaigns/delete-campaign-danger-zone";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const [campaign, availableCreators] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id: campaignId, ...campaignVisibilityWhere(session) },
      include: {
        campaignCreators: {
          include: { creator: true },
        },
        bonusTiers: { orderBy: { viewThreshold: "asc" } },
      },
    }),
    prisma.creator.findMany({
      where: { ...creatorVisibilityWhere(session), isActive: true },
      select: { id: true, name: true, handle: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!campaign) notFound();

  const initialData = {
    name: campaign.name,
    isActive: campaign.isActive,
    startDate: format(campaign.startDate, "yyyy-MM-dd"),
    endDate: format(campaign.endDate, "yyyy-MM-dd"),
    hashtags: campaign.hashtags,
    weeklyPostTarget: campaign.weeklyPostTarget,
    monthlyPostGoal: campaign.monthlyPostGoal,
    offPacePct: campaign.offPacePct,
    quietDays: campaign.quietDays,
    bonusCapUsd: campaign.bonusCapUsd === null ? null : Number(campaign.bonusCapUsd),
    bonusTiers: campaign.bonusTiers.map((t) => ({
      viewThreshold: t.viewThreshold,
      amountUsd: Number(t.amountUsd),
    })),
    previewLinks: campaign.previewLinks,
    galleryUrls: campaign.galleryUrls,
    creators: campaign.campaignCreators.map((cc) => ({
      id: cc.id,
      creatorId: cc.creatorId,
      platform: cc.platform as "TIKTOK" | "INSTAGRAM" | "YOUTUBE" | "FACEBOOK",
      videosPerDay: cc.videosPerDay,
      monthlyPostGoal: cc.monthlyPostGoal,
      isActive: cc.isActive,
    })),
  };

  return (
    <div>
      <PageHeader
        title={`Edit: ${campaign.name}`}
        description="Update campaign settings"
      />
      <CampaignForm
        campaignId={campaignId}
        availableCreators={availableCreators}
        initialData={initialData}
      />
      <DeleteCampaignDangerZone
        campaignId={campaign.id}
        campaignName={campaign.name}
      />
    </div>
  );
}
