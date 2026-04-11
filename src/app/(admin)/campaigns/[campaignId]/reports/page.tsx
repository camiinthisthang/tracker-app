import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { ReportConfig } from "@/components/reports/report-config";

export default async function CampaignReportsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, teamId: session.user.teamId },
  });

  if (!campaign) notFound();

  const config = await prisma.weeklyReportConfig.findFirst({
    where: { campaignId },
  });

  const serializedConfig = config
    ? {
        id: config.id,
        isEnabled: config.isEnabled,
        recipients: config.recipients,
        publicSlug: config.publicSlug,
      }
    : null;

  return (
    <div>
      <ReportConfig campaignId={campaignId} config={serializedConfig} />
    </div>
  );
}
