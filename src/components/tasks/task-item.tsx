"use client";

import { useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  id: string;
  title: string;
  type: string;
  dueDate: string;
  isCompleted: boolean;
  onToggle: (taskId: string, completed: boolean) => void;
}

export function TaskItem({
  id,
  title,
  type,
  dueDate,
  isCompleted,
  onToggle,
}: TaskItemProps) {
  const [completed, setCompleted] = useState(isCompleted);
  const due = new Date(dueDate);
  const isOverdue = !completed && isBefore(due, startOfDay(new Date()));

  function handleToggle() {
    const newValue = !completed;
    setCompleted(newValue);
    onToggle(id, newValue);
  }

  return (
    <div className="flex items-center gap-3 py-1.5">
      <button onClick={handleToggle} className="shrink-0">
        {completed ? (
          <CheckCircle2 className="h-5 w-5 text-blue-500" />
        ) : (
          <Circle className="h-5 w-5 text-slate-300 hover:text-slate-400" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            completed
              ? "text-slate-400 line-through"
              : "text-slate-700"
          )}
        >
          {title}
          {type === "UPLOAD_FOR_REVIEW" && (
            <span className="ml-1 text-blue-500 hover:text-blue-600">
              open
              <ExternalLink className="ml-0.5 inline h-3 w-3" />
            </span>
          )}
        </p>
        <p
          className={cn(
            "text-xs",
            isOverdue ? "font-medium text-red-500" : "text-slate-400"
          )}
        >
          {isOverdue && "Overdue · "}
          due {format(due, "EEE MMM do")}
        </p>
      </div>
    </div>
  );
}
