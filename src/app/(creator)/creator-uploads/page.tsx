import { format } from "date-fns";
import { CheckCircle, Clock, XCircle, FileVideo } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { CreatorUploadForm } from "@/components/creators/creator-upload-form";

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Clock; className: string }
> = {
  PENDING: {
    label: "Pending review",
    icon: Clock,
    className: "bg-yellow-50 text-yellow-700",
  },
  APPROVED: {
    label: "Approved",
    icon: CheckCircle,
    className: "bg-green-50 text-green-700",
  },
  REJECTED: {
    label: "Needs re-shoot",
    icon: XCircle,
    className: "bg-red-50 text-red-600",
  },
};

export default async function CreatorUploadsPage() {
  const session = await getRequiredSession();
  const creatorId = session.user.creatorId;

  if (!creatorId) {
    return (
      <div>
        <PageHeader title="Uploads" description="Submit videos for review" />
        <p className="text-sm text-slate-400">
          Your creator profile is not linked yet.
        </p>
      </div>
    );
  }

  const campaigns = await prisma.campaignCreator.findMany({
    where: { creatorId, isActive: true },
    include: { campaign: { select: { id: true, name: true, isActive: true } } },
  });

  const activeCampaigns = campaigns
    .filter((cc) => cc.campaign.isActive)
    .map((cc) => cc.campaign);

  const uploads = await prisma.upload.findMany({
    where: { creatorId },
    include: { campaign: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const pending = uploads.filter((u) => u.status === "PENDING").length;
  const approved = uploads.filter((u) => u.status === "APPROVED").length;
  const rejected = uploads.filter((u) => u.status === "REJECTED").length;

  return (
    <div>
      <PageHeader
        title="Uploads"
        description="Submit videos for review before posting"
      />

      {/* Upload form */}
      <CreatorUploadForm campaigns={activeCampaigns} />

      {/* Stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-4">
          <p className="text-xs text-yellow-700">Pending review</p>
          <p className="mt-1 text-2xl font-bold text-yellow-700">{pending}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
          <p className="text-xs text-green-700">Approved</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{approved}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <p className="text-xs text-red-600">Needs re-shoot</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{rejected}</p>
        </div>
      </div>

      {/* Uploads list */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Your Uploads ({uploads.length})
          </h3>
        </div>
        {uploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FileVideo className="h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">
              You haven&apos;t uploaded any videos yet
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {uploads.map((u) => {
              const cfg = STATUS_CONFIG[u.status] || STATUS_CONFIG.PENDING;
              const Icon = cfg.icon;
              return (
                <div key={u.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700">
                        {u.fileName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {u.campaign.name} ·{" "}
                        {format(u.createdAt, "MMM d, yyyy h:mm a")}
                      </p>
                      {u.feedback && (
                        <div className="mt-2 rounded-lg bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase text-slate-500">
                            Manager feedback
                          </p>
                          <p className="mt-1 text-xs text-slate-700">
                            {u.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                    <Badge className={`${cfg.className} hover:opacity-90`}>
                      <Icon className="mr-1 h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
