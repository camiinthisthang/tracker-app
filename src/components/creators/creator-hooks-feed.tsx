import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface CreatorHookRow {
  id: string;
  onScreenText: string;
  caption: string | null;
  videoDirection: string | null;
  campaign: { name: string } | null;
  publishedAt: string | null;
}

export function CreatorHooksFeed({ hooks }: { hooks: CreatorHookRow[] }) {
  if (hooks.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-800">
            Hooks for you to test
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          {hooks.length} {hooks.length === 1 ? "hook" : "hooks"}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Pick one of these for your next video. Each shows the on-screen text,
        the caption to use, and what to do on camera.
      </p>

      <ul className="mt-4 space-y-3">
        {hooks.map((h) => (
          <li
            key={h.id}
            className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
          >
            <p className="text-sm font-medium text-slate-900">
              {h.onScreenText}
            </p>
            {h.caption && (
              <p className="mt-1.5 text-xs text-slate-700">
                <span className="font-medium text-slate-500">Caption:</span>{" "}
                {h.caption}
              </p>
            )}
            {h.videoDirection && (
              <p className="mt-1 text-xs text-slate-700">
                <span className="font-medium text-slate-500">Video:</span>{" "}
                {h.videoDirection}
              </p>
            )}
            {h.campaign && (
              <div className="mt-2">
                <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                  {h.campaign.name}
                </Badge>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
