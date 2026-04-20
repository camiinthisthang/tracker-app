"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface DeleteCreatorDangerZoneProps {
  creatorId: string;
  creatorName: string;
}

export function DeleteCreatorDangerZone({
  creatorId,
  creatorName,
}: DeleteCreatorDangerZoneProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const confirmMatches = typed.trim() === creatorName.trim();

  async function handleDelete() {
    if (!confirmMatches) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Failed to delete creator");
        setDeleting(false);
        return;
      }
      toast.success("Creator deleted");
      router.push("/creators");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-red-200 bg-white p-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-semibold text-red-700">
            Danger zone
          </span>
        </div>
        <span className="text-xs text-slate-400">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-slate-500">
            Deleting this creator removes their profile, posts, tasks, uploads,
            messages, campaign assignments, attribution data, and login account.
            This cannot be undone.
          </p>
          <Button
            type="button"
            onClick={() => {
              setTyped("");
              setDialogOpen(true);
            }}
            className="bg-red-600 text-white hover:bg-red-700"
            size="sm"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete creator
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {creatorName}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the creator and every associated row
              (posts, tasks, uploads, messages, campaign assignments, login).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-name" className="text-xs text-slate-600">
              Type{" "}
              <span className="font-mono font-semibold text-slate-800">
                {creatorName}
              </span>{" "}
              to confirm.
            </Label>
            <Input
              id="confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={creatorName}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={!confirmMatches || deleting}
              className="bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300"
            >
              {deleting ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
