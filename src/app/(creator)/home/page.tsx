import { format } from "date-fns";
import {
  BookOpen,
  LayoutGrid,
  Image,
  Trophy,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { TaskList } from "@/components/tasks/task-list";

export default async function CreatorHomePage() {
  const session = await getRequiredSession();
  const creatorId = session.user.creatorId;

  // Get creator's tasks
  const tasks = creatorId
    ? await prisma.task.findMany({
        where: { creatorId },
        include: {
          campaign: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true, handle: true } },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  // Get unique campaigns for filter tabs
  const campaignMap = new Map<string, { id: string; name: string }>();
  for (const t of tasks) {
    campaignMap.set(t.campaign.id, t.campaign);
  }
  const campaigns = Array.from(campaignMap.values());

  const serializedTasks = tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate.toISOString(),
    completedAt: t.completedAt?.toISOString() || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  const today = format(new Date(), "EEE, MMM do");

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Home</h1>
        <p className="text-sm text-slate-400">{today}</p>
        <p className="mt-2 text-sm text-slate-600">
          hey {session.user.name || "there"} - here&apos;s what you have going
          on today
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Task list */}
        <div>
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
              <p className="text-sm text-slate-400">
                No tasks assigned to you yet
              </p>
            </div>
          ) : (
            <TaskList tasks={serializedTasks} campaigns={campaigns} />
          )}
        </div>

        {/* Quick links sidebar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Quick links</h3>
          <div className="mt-3 space-y-1">
            <QuickLink icon={BookOpen} label="Creator playbook" />
            <QuickLink icon={LayoutGrid} label="Gallery link" />
            <QuickLink icon={Image} label="Creator portfolio" />
            <QuickLink icon={Sparkles} label="Sora AI videos" />
            <QuickLink icon={Trophy} label="Leaderboard" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
      <Icon className="h-4 w-4 text-slate-400" />
      {label}
    </button>
  );
}
