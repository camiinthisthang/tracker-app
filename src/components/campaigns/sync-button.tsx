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

      // Sync now runs in the background to avoid Vercel function timeouts on
      // campaigns with many creators. We don't have post counts to show — the
      // user refreshes the page once metrics finish updating (a few minutes).
      toast.success(
        "Sync started — give it a couple of minutes, then refresh to see the latest posts and view counts.",
        { duration: 8000 }
      );

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
