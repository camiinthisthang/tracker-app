import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import { UploadsManager } from "@/components/campaigns/uploads-manager";

export default async function CampaignUploadsPage({
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

  const uploads = await prisma.upload.findMany({
    where: { campaignId },
    include: {
      creator: { select: { id: true, name: true, handle: true } },
      campaign: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = uploads.map((u) => ({
    ...u,
    fileSize: u.fileSize,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    reviewedAt: u.reviewedAt?.toISOString() || null,
  }));

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "MEMBER";

  return (
    <div>
      <UploadsManager uploads={serialized} isAdmin={isAdmin} />
    </div>
  );
}
