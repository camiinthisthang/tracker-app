import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import { ReportConfig } from "@/components/reports/report-config";

export default async function CampaignReportsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...campaignVisibilityWhere(session) },
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
    <div className="space-y-6">
      <Link
        href={`/campaigns/${campaignId}/reports/view`}
        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 hover:bg-blue-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              View full report
            </p>
            <p className="text-xs text-slate-500">
              KPIs, platform split, top posts, trends — print or save as PDF.
            </p>
          </div>
        </div>
        <span className="text-sm font-medium text-blue-600">Open →</span>
      </Link>

      <ReportConfig campaignId={campaignId} config={serializedConfig} />
    </div>
  );
}
