import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeReport } from "@/lib/reports/report-data";
import { ClientReport } from "@/components/reports/client-report";

/**
 * Public shareable report — the link clients receive. Renders the same
 * branded report as the internal campaign view, pinned to the full campaign
 * window (no date controls on a public link), via the unguessable
 * WeeklyReportConfig.publicSlug. No session required by design.
 */
export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const config = await prisma.weeklyReportConfig.findUnique({
    where: { publicSlug: slug },
    select: { campaignId: true },
  });

  if (!config) notFound();

  const data = await computeReport(
    { type: "campaign", campaignId: config.campaignId },
    undefined,
    { defaultWindow: "full" }
  );

  return <ClientReport data={data} publicView />;
}
