"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  creatorId: string;
  /** Show a hint/explanation when the creator has no active campaign yet. */
  hasActiveCampaign: boolean;
  /** True when this creator has at least one real public handle stored. */
  hasHandles: boolean;
}

export function SyncCreatorButton({
  creatorId,
  hasActiveCampaign,
  hasHandles,
}: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

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
      const lines = [
        `Fetched ${data.fetched} posts (TikTok: ${data.tiktokPosts}, Instagram: ${data.instagramPosts})`,
        `Saved ${data.upserted} to the DB.`,
      ];
      if (data.warning) lines.push(data.warning);
      toast.success(lines.join(" "), { duration: 7000 });
      router.refresh();
    } catch {
      toast.error("Sync failed — check server logs");
    } finally {
      setSyncing(false);
    }
  }

  const disabled = syncing || !hasHandles;
  const tooltip = !hasHandles
    ? "Creator hasn't set a TikTok or Instagram handle yet"
    : !hasActiveCampaign
    ? "Tip: posts only save when the creator is on an active campaign"
    : undefined;

  return (
    <Button
      type="button"
      onClick={handleSync}
      disabled={disabled}
      className="bg-slate-900 text-white hover:bg-slate-800"
      title={tooltip}
    >
      <RefreshCw
        className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
      />
      {syncing ? "Syncing..." : "Sync posts"}
    </Button>
  );
}
