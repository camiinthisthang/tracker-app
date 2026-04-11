import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, teamId: session.user.teamId },
    include: {
      campaignCreators: {
        include: { creator: true },
      },
    },
  });

  if (!campaign) notFound();

  const initialData = {
    name: campaign.name,
    isActive: campaign.isActive,
    startDate: format(campaign.startDate, "yyyy-MM-dd"),
    endDate: format(campaign.endDate, "yyyy-MM-dd"),
    hashtags: campaign.hashtags,
    weeklyPostTarget: campaign.weeklyPostTarget,
    previewLinks: campaign.previewLinks,
    galleryUrls: campaign.galleryUrls,
    creators: campaign.campaignCreators.map((cc) => ({
      id: cc.id,
      handle: cc.creator.handle,
      creatorName: cc.creator.name,
      platform: cc.platform as "TIKTOK" | "INSTAGRAM" | "YOUTUBE" | "FACEBOOK",
      videosPerDay: cc.videosPerDay,
      isActive: cc.isActive,
    })),
  };

  return (
    <div>
      <PageHeader
        title={`Edit: ${campaign.name}`}
        description="Update campaign settings"
      />
      <CampaignForm campaignId={campaignId} initialData={initialData} />
    </div>
  );
}
