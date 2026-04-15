import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { PinnedMessages } from "@/components/creators/pinned-messages";

export default async function CreatorTasksPage() {
  const session = await getRequiredSession();
  const creatorId = session.user.creatorId;

  if (!creatorId) {
    return (
      <div>
        <PageHeader title="Tasks" />
        <p className="text-sm text-slate-400">No creator profile linked.</p>
      </div>
    );
  }

  const [tasks, pinnedMessages] = await Promise.all([
    prisma.task.findMany({
      where: { creatorId },
      include: {
        campaign: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, handle: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.creatorMessage.findMany({
      where: { creatorId, isPinned: true },
      include: { campaign: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const campaignMap = new Map<string, { id: string; name: string }>();
  for (const t of tasks) {
    if (t.campaign) campaignMap.set(t.campaign.id, t.campaign);
  }
  const campaigns = Array.from(campaignMap.values());

  const serialized = tasks.map((t) => ({
    ...t,
    campaign: t.campaign ?? null,
    dueDate: t.dueDate.toISOString(),
    completedAt: t.completedAt?.toISOString() || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const serializedPinned = pinnedMessages.map((m) => ({
    id: m.id,
    type: m.type,
    title: m.title,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    campaign: m.campaign,
  }));

  return (
    <div>
      <PageHeader title="Tasks" description="What you have to do this week" />
      <PinnedMessages messages={serializedPinned} />
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-slate-400">No tasks assigned to you yet</p>
        </div>
      ) : (
        <TaskList tasks={serialized} campaigns={campaigns} />
      )}
    </div>
  );
}
