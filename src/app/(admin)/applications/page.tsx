import { format } from "date-fns";
import { Inbox, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAgencyAccess } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { InterviewInviteButton } from "@/components/applications/interview-invite-button";
import { ApplicationActions } from "@/components/applications/application-actions";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  REVIEWING: "bg-blue-50 text-blue-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
};

export default async function ApplicationsPage() {
  const session = await requireAgencyAccess();

  const [applications, team] = await Promise.all([
    prisma.creatorApplication.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.team.findUnique({
      where: { id: session.user.teamId },
      include: { settings: true },
    }),
  ]);

  const teamName = team?.name || "Viewtrackr";
  const schedulingUrl = team?.settings?.schedulingUrl || null;

  const pendingCount = applications.filter((a) => a.status === "PENDING").length;
  const reviewingCount = applications.filter(
    (a) => a.status === "REVIEWING"
  ).length;
  const approvedCount = applications.filter(
    (a) => a.status === "APPROVED"
  ).length;

  return (
    <div>
      <PageHeader
        title="Creator Applications"
        description="Review applications from the public /apply page"
      />

      {applications.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No applications yet"
          description="Applications from your /apply page will appear here."
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <StatCard label="Total" value={applications.length} />
            <StatCard label="Pending" value={pendingCount} />
            <StatCard label="In interview" value={reviewingCount} />
            <StatCard label="Approved" value={approvedCount} />
          </div>

          <div className="space-y-3">
            {applications.map((app) => (
              <div
                key={app.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {app.name}
                      </h3>
                      <Badge
                        className={`${STATUS_COLORS[app.status]} hover:opacity-90`}
                      >
                        {app.status === "REVIEWING" ? "IN INTERVIEW" : app.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {app.email}
                      {app.phone && ` · ${app.phone}`}
                      {app.location && ` · ${app.location}`}
                    </p>
                    {(app.instagramHandle || app.tiktokHandle) && (
                      <p className="mt-1 text-xs text-slate-400">
                        {app.instagramHandle && `IG: ${app.instagramHandle}`}
                        {app.instagramHandle && app.tiktokHandle && " · "}
                        {app.tiktokHandle && `TikTok: ${app.tiktokHandle}`}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {format(app.createdAt, "MMM d, yyyy")}
                  </span>
                </div>

                {/* About */}
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {app.about}
                </p>

                {/* Video links */}
                {app.videoUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {app.videoUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-100"
                      >
                        Video {i + 1}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {app.status !== "REJECTED" && (
                    <InterviewInviteButton
                      applicationId={app.id}
                      applicantName={app.name}
                      applicantEmail={app.email}
                      teamName={teamName}
                      schedulingUrl={schedulingUrl}
                      currentStatus={app.status}
                    />
                  )}
                  <ApplicationActions
                    applicationId={app.id}
                    currentStatus={app.status}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
