import { Pin, Megaphone, Lightbulb, MessageSquare, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinnedMessage {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  campaign?: { name: string } | null;
}

const TYPE_ICON: Record<string, typeof Megaphone> = {
  ANNOUNCEMENT: Megaphone,
  HOOK_SUGGESTION: Lightbulb,
  FEEDBACK: MessageSquare,
  CAMPAIGN_UPDATE: Target,
};

export function PinnedMessages({ messages }: { messages: PinnedMessage[] }) {
  if (messages.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100">
          <Pin className="h-3.5 w-3.5 text-amber-700" />
        </div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
          Pinned — read first
        </h3>
      </div>
      <div className="space-y-3">
        {messages.map((msg) => {
          const Icon = TYPE_ICON[msg.type] || Megaphone;
          return (
            <div
              key={msg.id}
              className="rounded-lg border border-amber-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                  <Icon className="h-4 w-4 text-amber-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-semibold text-slate-800")}>
                    {msg.title}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                    {msg.body}
                  </p>
                  {msg.campaign && (
                    <span className="mt-2 inline-block text-[10px] text-slate-400">
                      {msg.campaign.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
