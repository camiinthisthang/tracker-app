import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Lightbulb, MessageSquare, Megaphone, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatorMessage {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  campaign?: { name: string } | null;
}

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Lightbulb; color: string; bg: string; label: string }
> = {
  HOOK_SUGGESTION: {
    icon: Lightbulb,
    color: "text-amber-600",
    bg: "bg-amber-50",
    label: "Hook",
  },
  FEEDBACK: {
    icon: MessageSquare,
    color: "text-blue-600",
    bg: "bg-blue-50",
    label: "Feedback",
  },
  ANNOUNCEMENT: {
    icon: Megaphone,
    color: "text-violet-600",
    bg: "bg-violet-50",
    label: "Announcement",
  },
  CAMPAIGN_UPDATE: {
    icon: Target,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    label: "Campaign",
  },
};

export function CreatorMessagesFeed({
  messages,
  limit,
  showViewAll = false,
}: {
  messages: CreatorMessage[];
  limit?: number;
  showViewAll?: boolean;
}) {
  const displayed = limit ? messages.slice(0, limit) : messages;
  const unread = messages.filter((m) => !m.isRead).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">
            From your manager
          </h3>
          {unread > 0 && (
            <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unread} new
            </span>
          )}
        </div>
        {showViewAll && (
          <Link
            href="/creator-tasks"
            className="text-xs font-medium text-blue-500 hover:text-blue-600"
          >
            View all
          </Link>
        )}
      </div>

      {displayed.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">
          No messages yet. Your manager will post updates here.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {displayed.map((msg) => {
            const cfg = TYPE_CONFIG[msg.type] || TYPE_CONFIG.ANNOUNCEMENT;
            const Icon = cfg.icon;
            return (
              <div
                key={msg.id}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  msg.isRead
                    ? "border-slate-200 bg-white"
                    : "border-blue-200 bg-blue-50/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      cfg.bg
                    )}
                  >
                    <Icon className={cn("h-4 w-4", cfg.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {msg.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {formatDistanceToNow(new Date(msg.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">{msg.body}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          cfg.bg,
                          cfg.color
                        )}
                      >
                        {cfg.label}
                      </span>
                      {msg.campaign && (
                        <span className="text-[10px] text-slate-400">
                          {msg.campaign.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
