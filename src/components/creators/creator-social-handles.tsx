"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Save, Music2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  creatorId: string;
  tiktokHandle: string | null;
  instagramHandle: string | null;
  fallbackHandle: string;
}

export function CreatorSocialHandles({
  creatorId,
  tiktokHandle,
  instagramHandle,
  fallbackHandle,
}: Props) {
  const router = useRouter();
  const [tt, setTt] = useState(tiktokHandle ?? "");
  const [ig, setIg] = useState(instagramHandle ?? "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
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
      toast.success("Handles saved");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}/sync`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Sync failed");
        return;
      }
      const msg = `Fetched ${data.fetched} posts (TT: ${data.tiktokPosts}, IG: ${data.instagramPosts}). Upserted ${data.upserted}.${
        data.warning ? ` ${data.warning}` : ""
      }`;
      toast.success(msg);
      router.refresh();
    } catch {
      toast.error("Sync failed — check server logs");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Social handles
          </h3>
          <p className="text-xs text-slate-500">
            Used by the daily Apify sync to pull real TikTok + Instagram
            metrics into this creator&apos;s dashboard.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing ? "Syncing..." : "Sync now"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="flex items-center gap-1.5 text-xs text-slate-600">
            <Music2 className="h-3 w-3" />
            TikTok handle
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
          </Label>
          <Input
            placeholder="their.insta.handle"
            value={ig}
            onChange={(e) => setIg(e.target.value)}
          />
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
