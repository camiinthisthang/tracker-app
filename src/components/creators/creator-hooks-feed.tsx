"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface CreatorHookRow {
  id: string;
  onScreenText: string;
  caption: string | null;
  videoDirection: string | null;
  prompt: string | null;
  ponchoPrompt: string | null;
  inspirationLink: string | null;
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
      <p className="mt-1 text-xs text-slate-500">
        Pick one, grab your ring light, copy what you need, hit record. Each hook
        shows the on-screen text, what to say, and (if it needs one) a Poncho
        prompt you can paste straight in.
      </p>

      <ul className="mt-4 space-y-3">
        {hooks.map((h) => (
          <HookItem key={h.id} hook={h} />
        ))}
      </ul>
    </div>
  );
}

function HookItem({ hook }: { hook: CreatorHookRow }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <CopyableField
        label="On-screen text"
        helper="Type this on top of your video."
        value={hook.onScreenText}
        emphasis
      />

      {hook.prompt && (
        <div className="mt-3">
          <CopyableField
            label="What to say (spoken voice)"
            helper="Say this out loud while filming."
            value={hook.prompt}
          />
        </div>
      )}

      {hook.videoDirection && (
        <div className="mt-3">
          <PlainField
            label="What to do on camera"
            value={hook.videoDirection}
          />
        </div>
      )}

      {hook.caption && (
        <div className="mt-3">
          <CopyableField
            label="Caption"
            helper="Paste this under the post on TikTok / Instagram."
            value={hook.caption}
          />
        </div>
      )}

      {hook.ponchoPrompt && (
        <div className="mt-3">
          <CopyableField
            label="Poncho prompt"
            helper="Paste this into Poncho to generate the image / screen for the video."
            value={hook.ponchoPrompt}
            mono
          />
        </div>
      )}

      {hook.inspirationLink && (
        <div className="mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Inspiration
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            An example of what good looks like for this hook.
          </p>
          <a
            href={hook.inspirationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            Watch reference
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {hook.campaign && (
        <div className="mt-3">
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">
            {hook.campaign.name}
          </Badge>
        </div>
      )}
    </li>
  );
}

function CopyableField({
  label,
  helper,
  value,
  emphasis,
  mono,
}: {
  label: string;
  helper?: string;
  value: string;
  emphasis?: boolean;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn’t copy — long-press to copy manually");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copy}
          className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800"
        >
          {copied ? (
            <>
              <Check className="mr-1 h-3 w-3 text-emerald-600" /> Copied
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3 w-3" /> Copy
            </>
          )}
        </Button>
      </div>
      {helper && <p className="text-[11px] text-slate-400">{helper}</p>}
      <p
        className={
          (emphasis
            ? "mt-1 text-sm font-medium text-slate-900"
            : "mt-1 text-xs text-slate-700") +
          (mono ? " whitespace-pre-wrap font-mono text-[11px]" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}

function PlainField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xs text-slate-700">{value}</p>
    </div>
  );
}
