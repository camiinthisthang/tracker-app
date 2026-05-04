import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { creatorVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export default async function NewCampaignPage() {
  const session = await getRequiredSession();

  const availableCreators = await prisma.creator.findMany({
    where: { ...creatorVisibilityWhere(session), isActive: true },
    select: { id: true, name: true, handle: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="New Campaign"
        description="Set up a new campaign and add creators"
      />
      <CampaignForm availableCreators={availableCreators} />
    </div>
  );
}
