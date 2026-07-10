"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
      const counts = [
        `TikTok: ${data.tiktokPosts}`,
        `Instagram: ${data.instagramPosts}`,
        data.youtubeAttempted ? `YouTube: ${data.youtubePosts}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      const lines = [
        `Fetched ${data.fetched} posts (${counts})`,
        `Saved ${data.upserted} to the DB.`,
      ];
      const failures: { platform: string; handle: string; error: string }[] =
        data.failures ?? [];
      for (const f of failures) {
        lines.push(
          `${f.platform === "TIKTOK" ? "TikTok" : f.platform === "INSTAGRAM" ? "Instagram" : "YouTube"} fetch failed for @${f.handle}: ${f.error}`
        );
      }
      const skipped =
        typeof data.droppedOutOfRange === "number" ? data.droppedOutOfRange : 0;
      if (skipped > 0) {
        const range =
          data.window?.start && data.window?.end
            ? ` (campaign window ${fmtDate(data.window.start)}–${fmtDate(data.window.end)})`
            : "";
        lines.push(`Skipped ${skipped} outside the campaign's date range${range}.`);
        const datesOutside = (data.droppedPosts ?? [])
          .map(
            (p: { platform: string; postedAt: string; views: number }) =>
              `${p.platform === "TIKTOK" ? "TikTok" : "Instagram"} ${fmtDate(p.postedAt)} (${p.views.toLocaleString()} views)`
          )
          .join(", ");
        if (datesOutside) lines.push(`Outside the window: ${datesOutside}.`);
      }
      if (typeof data.prunedOutOfRange === "number" && data.prunedOutOfRange > 0) {
        lines.push(
          `Removed ${data.prunedOutOfRange} previously-tracked post${data.prunedOutOfRange === 1 ? "" : "s"} from outside the window.`
        );
      }
      if (data.warning) lines.push(data.warning);
      // When posts were skipped or a platform fetch failed, keep the toast on
      // screen long enough to read and act on.
      if (skipped > 0 || data.warning || failures.length > 0) {
        toast.warning(lines.join(" "), { duration: 15000 });
      } else {
        toast.success(lines.join(" "), { duration: 7000 });
      }
      router.refresh();
    } catch {
      toast.error("Sync failed — check server logs");
    } finally {
      setSyncing(false);
    }
  }

  const disabled = syncing || !hasHandles;
  const tooltip = !hasHandles
    ? "Creator hasn't set a TikTok, Instagram, or YouTube handle yet"
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
