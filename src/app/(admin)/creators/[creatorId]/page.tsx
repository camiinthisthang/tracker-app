import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TierBadge } from "@/components/creators/tier-badge";
import { InviteCreatorButton } from "@/components/creators/invite-creator-button";
import { CreatorSocialHandles } from "@/components/creators/creator-social-handles";
import { AssignToCampaign } from "@/components/creators/assign-to-campaign";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Music } from "lucide-react";
import { PLATFORM_LABELS } from "@/lib/constants";

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const session = await getRequiredSession();
  const { creatorId } = await params;

  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: {
      campaignCreators: {
        include: {
          campaign: { select: { id: true, name: true, isActive: true } },
        },
      },
      teamMember: { select: { id: true } },
      _count: { select: { posts: true } },
    },
  });

  if (!creator) notFound();

  // Visibility: super admin sees any creator; client managers see creators
  // assigned to one of their team's campaigns OR creators "homed" on their team.
  const allowed = await canAccessCreator(prisma, creator, session);
  if (!allowed) notFound();

  const [totalViews, totalSignups, allCampaigns] = await Promise.all([
    prisma.post.aggregate({
      where: { creatorId },
      _sum: { views: true },
    }),
    prisma.creatorAttribution.aggregate({
      where: { creatorId },
      _sum: { signupCount: true },
    }),
    session.user.isSuperAdmin
      ? prisma.campaign.findMany({
          select: { id: true, name: true, isActive: true },
          orderBy: { name: "asc" },
        })
      : prisma.campaign.findMany({
          where: { teamId: session.user.teamId },
          select: { id: true, name: true, isActive: true },
          orderBy: { name: "asc" },
        }),
  ]);
  const attributedSignups = totalSignups._sum.signupCount ?? 0;

  return (
    <div>
      <PageHeader title={creator.name} description={`@${creator.handle}`} />

      {/* Profile Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-xl font-semibold text-slate-600">
            {creator.name[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {creator.name}
            </h2>
            <p className="text-sm text-slate-500">@{creator.handle}</p>
            <div className="mt-2 flex items-center gap-2">
              <TierBadge tier={creator.tier} />
              <Badge
                className={
                  creator.isActive
                    ? "bg-green-50 text-green-600"
                    : "bg-slate-100 text-slate-500"
                }
              >
                {creator.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Account & TikTok Status */}
      <div className="mt-4 space-y-3">
        {/* Account status */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Creator account
            </p>
            <p className="text-xs text-slate-500">
              {creator.teamMember
                ? `Signed up${creator.email ? ` as ${creator.email}` : ""}`
                : "No account yet — send them an invite link to sign up"}
            </p>
          </div>
          <InviteCreatorButton
            creatorId={creator.id}
            creatorName={creator.name}
            hasAccount={!!creator.teamMember}
          />
        </div>

        {/* TikTok status (read-only for admins) */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900">
              <Music className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                TikTok account
              </p>
              <p className="text-xs text-slate-500">
                {creator.tiktokAccessToken
                  ? `@${creator.tiktokUsername} · Connected ${
                      creator.tiktokConnectedAt
                        ? new Date(creator.tiktokConnectedAt).toLocaleDateString()
                        : ""
                    }`
                  : "Creator must connect TikTok from their own profile"}
              </p>
            </div>
          </div>
          {creator.tiktokAccessToken && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
        </div>
      </div>

      {/* Social handles + manual sync trigger */}
      <div className="mt-4">
        <CreatorSocialHandles
          creatorId={creator.id}
          tiktokHandle={creator.tiktokHandle}
          instagramHandle={creator.instagramHandle}
          fallbackHandle={creator.handle}
        />
      </div>

      {/* Stats */}
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <StatCard label="Total Posts" value={creator._count.posts} />
        <StatCard
          label="Total Views"
          value={(totalViews._sum.views ?? 0).toLocaleString()}
        />
        <StatCard
          label="Attributed Signups"
          value={attributedSignups.toLocaleString()}
        />
        <StatCard
          label="Active Campaigns"
          value={
            creator.campaignCreators.filter((cc) => cc.campaign.isActive).length
          }
        />
      </div>

      {/* Campaigns */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Campaigns</h3>
        {creator.campaignCreators.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Not assigned to any campaigns yet — use the dropdown below to assign.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {creator.campaignCreators.map((cc) => (
              <div
                key={cc.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {cc.campaign.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {PLATFORM_LABELS[cc.platform]} · {cc.videosPerDay}{" "}
                    videos/day
                  </p>
                </div>
                <Badge
                  className={
                    cc.campaign.isActive
                      ? "bg-green-50 text-green-600"
                      : "bg-slate-100 text-slate-500"
                  }
                >
                  {cc.campaign.isActive ? "Active" : "Ended"}
                </Badge>
              </div>
            ))}
          </div>
        )}
        <AssignToCampaign
          creatorId={creator.id}
          existingCampaignIds={creator.campaignCreators.map(
            (cc) => cc.campaign.id
          )}
          campaigns={allCampaigns}
        />
      </div>
    </div>
  );
}
