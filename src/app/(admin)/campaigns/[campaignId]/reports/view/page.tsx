import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import { computeReport, parseReportRange } from "@/lib/reports/report-data";
import { ClientReport } from "@/components/reports/client-report";

export default async function CampaignReportViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...campaignVisibilityWhere(session) },
    select: { id: true },
  });
  if (!campaign) notFound();

  const range = parseReportRange(await searchParams);
  const data = await computeReport({ type: "campaign", campaignId }, range);

  return <ClientReport data={data} />;
}
