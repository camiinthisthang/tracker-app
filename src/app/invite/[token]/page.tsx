import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CreatorSignupForm } from "@/components/creators/creator-signup-form";
import { BarChart3 } from "lucide-react";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const creator = await prisma.creator.findUnique({
    where: { inviteToken: token },
    include: {
      team: { select: { name: true } },
      campaignCreators: {
        include: { campaign: { select: { name: true, isActive: true } } },
      },
    },
  });

  if (!creator) notFound();

  const activeCampaigns = creator.campaignCreators
    .filter((cc) => cc.campaign.isActive)
    .map((cc) => cc.campaign.name);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">
            You&apos;ve been invited!
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            <strong>{creator.team.name}</strong> is inviting you (
            <strong>@{creator.handle}</strong>) to join as a creator.
          </p>
          {activeCampaigns.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Active campaigns: {activeCampaigns.join(", ")}
            </p>
          )}
        </div>

        <CreatorSignupForm
          token={token}
          creatorName={creator.name}
        />
      </div>
    </div>
  );
}
