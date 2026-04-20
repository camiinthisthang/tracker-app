"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Music2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  tiktokHandle: string | null;
  instagramHandle: string | null;
}

export function SelfSocialHandles({ tiktokHandle, instagramHandle }: Props) {
  const router = useRouter();
  const [tt, setTt] = useState(tiktokHandle ?? "");
  const [ig, setIg] = useState(instagramHandle ?? "");
  const [saving, setSaving] = useState(false);

  const missing = !tiktokHandle && !instagramHandle;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/creators/me/social-handles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiktokHandle: tt.trim() || null,
          instagramHandle: ig.trim() || null,
        }),
      });
      if (!res.ok) {
        toast.error("Could not save handles");
        return;
      }
      toast.success("Handles saved — your stats will sync within 24 hours");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`rounded-xl border p-5 ${
        missing
          ? "border-blue-200 bg-blue-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Your social handles
        </h3>
        <p className="text-xs text-slate-500">
          {missing
            ? "Add your TikTok and Instagram handles so we can start tracking your videos."
            : "We pull stats from these accounts once a day. Update if your handle changes."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5 text-xs text-slate-600">
            <Music2 className="h-3 w-3" />
            TikTok handle
          </Label>
          <Input
            placeholder="your.tiktok.handle"
            value={tt}
            onChange={(e) => setTt(e.target.value)}
          />
          <p className="text-[10px] text-slate-400">Without the @</p>
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5 text-xs text-slate-600">
            <Camera className="h-3 w-3" />
            Instagram handle
          </Label>
          <Input
            placeholder="your.insta.handle"
            value={ig}
            onChange={(e) => setIg(e.target.value)}
          />
          <p className="text-[10px] text-slate-400">Without the @</p>
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
