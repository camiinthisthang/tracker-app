"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Music2, Camera, MonitorPlay } from "lucide-react";
import { HandleLink } from "@/components/creators/handle-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  creatorId: string;
  tiktokHandle: string | null;
  instagramHandle: string | null;
  youtubeHandle: string | null;
  fallbackHandle: string;
}

export function CreatorSocialHandles({
  creatorId,
  tiktokHandle,
  instagramHandle,
  youtubeHandle,
  fallbackHandle,
}: Props) {
  const router = useRouter();
  const [tt, setTt] = useState(tiktokHandle ?? "");
  const [ig, setIg] = useState(instagramHandle ?? "");
  const [yt, setYt] = useState(youtubeHandle ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiktokHandle: tt.trim() || null,
          instagramHandle: ig.trim() || null,
          youtubeHandle: yt.trim() || null,
        }),
      });
      if (!res.ok) {
        toast.error("Could not save handles");
        return;
      }
      toast.success("Handles saved");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Social handles
        </h3>
        <p className="text-xs text-slate-500">
          Creators set these themselves on their profile. You can override
          here if they typed them wrong. The daily Apify sync uses these to
          pull TikTok + Instagram + YouTube Shorts metrics.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5 text-xs text-slate-600">
            <Music2 className="h-3 w-3" />
            TikTok handle
            <HandleLink platform="TIKTOK" handle={tt} />
          </Label>
          <Input
            placeholder={fallbackHandle}
            value={tt}
            onChange={(e) => setTt(e.target.value)}
          />
          <p className="text-[10px] text-slate-400">
            Without @ — e.g. {fallbackHandle}
          </p>
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5 text-xs text-slate-600">
            <Camera className="h-3 w-3" />
            Instagram handle
            <HandleLink platform="INSTAGRAM" handle={ig} />
          </Label>
          <Input
            placeholder="their.insta.handle"
            value={ig}
            onChange={(e) => setIg(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5 text-xs text-slate-600">
            <MonitorPlay className="h-3 w-3" />
            YouTube handle
            <HandleLink platform="YOUTUBE" handle={yt} />
          </Label>
          <Input
            placeholder="their.youtube.handle"
            value={yt}
            onChange={(e) => setYt(e.target.value)}
          />
          <p className="text-[10px] text-slate-400">
            The @name of the channel — Shorts only
          </p>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 text-white hover:bg-slate-800"
        >
          <Save className="mr-2 h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save handles"}
        </Button>
      </div>
    </div>
  );
}
