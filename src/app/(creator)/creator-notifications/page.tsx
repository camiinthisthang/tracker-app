import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { CreatorMessagesFeed } from "@/components/creators/creator-messages";

export default async function CreatorNotificationsPage() {
  const session = await getRequiredSession();
  const creatorId = session.user.creatorId;

  if (!creatorId) {
    return (
      <div>
        <PageHeader title="Notifications" />
        <p className="text-sm text-slate-400">No creator profile linked.</p>
      </div>
    );
  }

  const messages = await prisma.creatorMessage.findMany({
    where: { creatorId },
    include: { campaign: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const serialized = messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Updates and notes from your manager"
      />
      <CreatorMessagesFeed messages={serialized} />
    </div>
  );
}
