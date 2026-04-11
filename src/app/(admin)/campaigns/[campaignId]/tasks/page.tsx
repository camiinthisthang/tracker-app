import { notFound } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { TaskList } from "@/components/tasks/task-list";
import { GenerateTasksButton } from "@/components/tasks/generate-tasks-button";

export default async function CampaignTasksPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const session = await getRequiredSession();
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, teamId: session.user.teamId },
    select: { id: true, name: true },
  });

  if (!campaign) notFound();

  const tasks = await prisma.task.findMany({
    where: { campaignId },
    include: {
      campaign: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, handle: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const serializedTasks = tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate.toISOString(),
    completedAt: t.completedAt?.toISOString() || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Tasks</h2>
        <GenerateTasksButton campaignId={campaignId} />
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
          <RefreshCw className="h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No tasks yet</p>
          <p className="text-xs text-slate-400">
            Click &quot;Generate Tasks&quot; to auto-create tasks for your creators
          </p>
        </div>
      ) : (
        <TaskList tasks={serializedTasks} campaigns={[campaign]} />
      )}
    </div>
  );
}
