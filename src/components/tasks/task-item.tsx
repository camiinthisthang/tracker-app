"use client";

import { useState } from "react";
import { format, isBefore, startOfDay } from "date-fns";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  dueDate: string;
  isCompleted: boolean;
  onToggle: (taskId: string, completed: boolean) => void;
}

export function TaskItem({
  id,
  title,
  description,
  type,
  dueDate,
  isCompleted,
  onToggle,
}: TaskItemProps) {
  const [completed, setCompleted] = useState(isCompleted);
  const [expanded, setExpanded] = useState(false);
  const due = new Date(dueDate);
  const isOverdue = !completed && isBefore(due, startOfDay(new Date()));
  const hasDescription = !!description && description.trim().length > 0;

  function handleToggle() {
    const newValue = !completed;
    setCompleted(newValue);
    onToggle(id, newValue);
  }

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-3">
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
              "text-sm flex items-center gap-1",
              completed
                ? "text-slate-400 line-through"
                : "text-slate-700"
            )}
          >
            {hasDescription ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-left hover:text-slate-900"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span>{title}</span>
              </button>
            ) : (
              <span>{title}</span>
            )}
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
      {hasDescription && expanded && (
        <div className="mt-2 ml-8 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap">
          {description}
        </div>
      )}
    </div>
  );
}
