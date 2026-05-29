import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  hasAgencyWideAccess,
  AGENCY_TEAM_SLUGS,
} from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { computeReport, parseReportRange } from "@/lib/reports/report-data";
import { ClientReport } from "@/components/reports/client-report";
import { ReportTeamPicker } from "@/components/reports/report-team-picker";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; team?: string }>;
}) {
  const session = await getRequiredSession();
  const sp = await searchParams;
  const range = parseReportRange(sp);

  // Client managers see their own team's report. Agency users (super admin /
  // agency manager) pick which client team to view from a dropdown.
  if (!hasAgencyWideAccess(session)) {
    const data = await computeReport(
      { type: "client", teamId: session.user.teamId },
      range
    );
    return (
      <>
        <ClientReport data={data} />
        <ScheduledReports session={session} />
      </>
    );
  }

  const teams = await prisma.team.findMany({
    where: { slug: { notIn: AGENCY_TEAM_SLUGS } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  if (teams.length === 0) {
    return (
      <div>
        <PageHeader
          title="Reports"
          description="Weekly client performance report"
        />
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-400">
          No client teams yet. Create a client team to generate its report.
        </p>
      </div>
    );
  }

  const selectedId =
    sp.team && teams.some((t) => t.id === sp.team) ? sp.team : teams[0].id;
  const data = await computeReport(
    { type: "client", teamId: selectedId },
    range
  );

  return (
    <>
      <ReportTeamPicker teams={teams} selectedId={selectedId} />
      <ClientReport data={data} />
      <ScheduledReports session={session} />
    </>
  );
}

async function ScheduledReports({
  session,
}: {
  session: Awaited<ReturnType<typeof getRequiredSession>>;
}) {
  const configs = await prisma.weeklyReportConfig.findMany({
    where: { campaign: campaignVisibilityWhere(session), isEnabled: true },
    include: { campaign: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="bg-slate-50 print-hidden">
      <div className="mx-auto max-w-5xl px-4 pb-8">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Scheduled campaign reports
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Campaign-level weekly reports are emailed every Monday at 9 AM
              team-local time to the recipients configured below.
            </p>
          </div>
          {configs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              No scheduled reports yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {configs.map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-800">
                    {c.campaign.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.recipients.length} recipient
                    {c.recipients.length === 1 ? "" : "s"}
                    {c.publicSlug && (
                      <>
                        {" · "}
                        <a
                          href={`/reports/${c.publicSlug}`}
                          className="text-blue-500 hover:text-blue-600"
                        >
                          public link
                        </a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
