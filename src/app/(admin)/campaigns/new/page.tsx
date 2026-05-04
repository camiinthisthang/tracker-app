import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  hasAgencyWideAccess,
  AGENCY_TEAM_SLUG,
} from "@/lib/auth";
import { creatorVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export default async function NewCampaignPage() {
  const session = await getRequiredSession();

  // Agency users get a client picker — campaigns must belong to a client team,
  // not the agency itself. Client managers skip this and the API falls back
  // to their own teamId.
  const availableTeams = hasAgencyWideAccess(session)
    ? await prisma.team.findMany({
        where: { slug: { not: AGENCY_TEAM_SLUG } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : undefined;

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
      <CampaignForm
        availableCreators={availableCreators}
        availableTeams={availableTeams}
      />
    </div>
  );
}
