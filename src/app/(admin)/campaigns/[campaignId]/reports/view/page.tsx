import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import { computeReport } from "@/lib/reports/report-data";
import { ClientReport } from "@/components/reports/client-report";

export default async function CampaignReportViewPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...campaignVisibilityWhere(session) },
    select: { id: true },
  });
  if (!campaign) notFound();

  const data = await computeReport({ type: "campaign", campaignId });

  return <ClientReport data={data} />;
}
