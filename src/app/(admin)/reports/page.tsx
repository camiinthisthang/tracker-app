import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { computeWeeklyDigest } from "@/lib/reports/weekly";

export default async function ReportsPage() {
  const session = await getRequiredSession();

  // Agency users (super admin / agency manager) get an aggregated digest
  // across every team. Client managers stay scoped to their own team — their
  // digest is the same as what the weekly-report cron emails them.
  const digestTeam = hasAgencyWideAccess(session) ? null : session.user.teamId;
  const digest = await computeWeeklyDigest(digestTeam);

  const configs = await prisma.weeklyReportConfig.findMany({
    where: { campaign: campaignVisibilityWhere(session), isEnabled: true },
    include: { campaign: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Weekly digest of team performance"
      />

      <p className="mb-4 text-xs text-slate-500">
        Week of {format(digest.weekStart, "MMM d")} —{" "}
        {format(digest.weekEnd, "MMM d, yyyy")}
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total views this week"
          value={digest.totalViews.toLocaleString()}
        />
        <StatCard label="Posts tracked" value={digest.totalPosts} />
        <StatCard
          label="Attributed signups"
          value={
            digest.attributedSignups === null
              ? "—"
              : digest.attributedSignups.toLocaleString()
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Top hooks by views
            </h3>
          </div>
          {digest.topHooks.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              No hook-tagged posts this week.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {digest.topHooks.map((h, i) => (
                <li
                  key={h.hook}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">#{i + 1}</p>
                    <p className="text-sm text-slate-700">{h.hook}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-slate-800">
                      {h.totalViews.toLocaleString()} views
                    </p>
                    <p className="text-xs text-slate-500">
                      {h.postCount} post{h.postCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Top creators by views
            </h3>
          </div>
          {digest.topCreators.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              No posts tracked this week.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {digest.topCreators.map((c, i) => (
                <li
                  key={c.creatorId}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">#{i + 1}</p>
                    <p className="text-sm text-slate-700">
                      {c.name}{" "}
                      <span className="text-slate-400">@{c.handle}</span>
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-slate-800">
                      {c.views.toLocaleString()} views
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.referrals.toLocaleString()} refs
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Scheduled campaign reports
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Campaign-level weekly reports are emailed out every Monday at 9 AM
            team-local-time to the recipients configured below.
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
  );
}
