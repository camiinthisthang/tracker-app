"use client";

import { useMemo, useState, useCallback } from "react";
import { format, isToday, isTomorrow, startOfDay } from "date-fns";
import { TaskItem } from "./task-item";

interface Task {
  id: string;
  title: string;
  type: string;
  dueDate: string;
  isCompleted: boolean;
  campaign: { id: string; name: string };
}

interface TaskListProps {
  tasks: Task[];
  campaigns: { id: string; name: string }[];
}

export function TaskList({ tasks, campaigns }: TaskListProps) {
  const [campaignFilter, setCampaignFilter] = useState("all");

  const filtered = useMemo(() => {
    if (campaignFilter === "all") return tasks;
    return tasks.filter((t) => t.campaign.id === campaignFilter);
  }, [tasks, campaignFilter]);

  // Group tasks by date
  const grouped = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const task of filtered) {
      const dateKey = startOfDay(new Date(task.dueDate)).toISOString();
      const existing = groups.get(dateKey) || [];
      existing.push(task);
      groups.set(dateKey, existing);
    }
    return Array.from(groups.entries()).sort(
      ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
    );
  }, [filtered]);

  const handleToggle = useCallback(async (taskId: string, completed: boolean) => {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, isCompleted: completed }),
    });
  }, []);

  function getDateLabel(dateStr: string) {
    const date = new Date(dateStr);
    if (isToday(date)) return "today";
    if (isTomorrow(date)) return "tomorrow";
    return format(date, "EEEE, MMM do");
  }

  return (
    <div>
      {/* Campaign filter tabs */}
      {campaigns.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setCampaignFilter("all")}
            className={`rounded-full px-3 py-1 text-sm ${
              campaignFilter === "all"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => setCampaignFilter(c.id)}
              className={`rounded-full px-3 py-1 text-sm ${
                campaignFilter === c.id
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Grouped task list */}
      {grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          No tasks scheduled
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateKey, dateTasks]) => {
            // Group by campaign within each date
            const byCampaign = new Map<string, Task[]>();
            for (const t of dateTasks) {
              const key = t.campaign.id;
              const existing = byCampaign.get(key) || [];
              existing.push(t);
              byCampaign.set(key, existing);
            }

            return (
              <div key={dateKey}>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">
                  {getDateLabel(dateKey)}
                </h3>
                {Array.from(byCampaign.entries()).map(
                  ([campaignId, campaignTasks]) => {
                    const campaignName = campaignTasks[0].campaign.name;
                    return (
                      <div key={campaignId} className="mb-3">
                        <p className="mb-1 text-xs font-medium text-slate-500">
                          {campaignName}
                        </p>
                        <div className="rounded-lg border border-slate-100 bg-white px-3 py-1">
                          {campaignTasks.map((task) => (
                            <TaskItem
                              key={task.id}
                              id={task.id}
                              title={task.title}
                              type={task.type}
                              dueDate={task.dueDate}
                              isCompleted={task.isCompleted}
                              onToggle={handleToggle}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
