import { notFound } from "next/navigation";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";
import { computeReport, parseReportRange } from "@/lib/reports/report-data";
import { ClientReport } from "@/components/reports/client-report";

export default async function ClientReportViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getRequiredSession();
  const { teamId } = await params;

  // Agency users can report on any client team; a client manager only on theirs.
  if (!hasAgencyWideAccess(session) && session.user.teamId !== teamId) {
    notFound();
  }

  const range = parseReportRange(await searchParams);
  const data = await computeReport({ type: "client", teamId }, range);

  return <ClientReport data={data} />;
}
