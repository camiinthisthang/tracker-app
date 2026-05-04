"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface SyncButtonProps {
  campaignId: string;
  campaignName: string;
  lastSyncAt?: string | null;
}

export function SyncButton({
  campaignId,
  campaignName,
  lastSyncAt,
}: SyncButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sync`, {
        method: "POST",
      });

      if (res.status === 429) {
        toast.error("Sync is rate limited to once per hour per campaign.");
        setOpen(false);
        setSyncing(false);
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data?.error ?? "Failed to sync.");
        setOpen(false);
        setSyncing(false);
        return;
      }

      const upserted = typeof data?.postsUpserted === "number" ? data.postsUpserted : 0;
      const prunedStale = typeof data?.prunedStale === "number" ? data.prunedStale : 0;
      const skipped: { creator: string; reason: string }[] = Array.isArray(data?.skipped)
        ? data.skipped
        : [];

      const pruneNote = prunedStale > 0
        ? ` Removed ${prunedStale} stale post${prunedStale === 1 ? "" : "s"} from old handles.`
        : "";

      if (upserted === 0 && prunedStale === 0) {
        const sample = skipped.slice(0, 3).map((s) => `@${s.creator} (${s.reason})`).join(", ");
        toast.warning(
          skipped.length > 0
            ? `Sync ran but added 0 posts. Skipped: ${sample}${skipped.length > 3 ? ` +${skipped.length - 3} more` : ""}`
            : "Sync ran but found no new posts. Check creators have TikTok/Instagram handles set, and that any campaign hashtag filter matches the actual post titles.",
          { duration: 10000 }
        );
      } else {
        toast.success(
          `Synced ${upserted} post${upserted === 1 ? "" : "s"}.${pruneNote}${skipped.length > 0 ? ` (${skipped.length} skipped)` : ""}`
        );
      }

      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm" type="button">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync Campaign Data</DialogTitle>
          <DialogDescription>
            This will refresh the data for <strong>all posts</strong> in the{" "}
            <strong>{campaignName}</strong> campaign by fetching the latest
            engagement metrics from social platforms.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            The sync process usually takes a few minutes to complete. You&apos;ll
            see updated view counts, likes, comments, shares, and saves once
            finished.
          </p>
          <p className="text-xs text-slate-400">
            Note: Manual syncs are limited to once per hour for each campaign to
            prevent overloading the system.
          </p>
          {lastSyncAt && (
            <p className="text-xs text-slate-400">
              Last synced: {new Date(lastSyncAt).toLocaleString()}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-slate-800 text-white hover:bg-slate-700"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? "Starting..." : "Start Sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
