import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { NotificationsManager } from "@/components/notifications/notifications-manager";

export default async function CampaignNotificationsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, teamId: session.user.teamId },
  });

  if (!campaign) notFound();

  const rules = await prisma.notificationRule.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
  });

  const serializedRules = rules.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div>
      <NotificationsManager
        campaignId={campaignId}
        rules={serializedRules}
      />
    </div>
  );
}
