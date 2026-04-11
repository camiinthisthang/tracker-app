"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle,
  XCircle,
  Clock,
  FileVideo,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Upload {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  status: string;
  feedback: string | null;
  reviewedAt: string | null;
  createdAt: string;
  creator: { id: string; name: string; handle: string };
}

interface UploadsManagerProps {
  uploads: Upload[];
  isAdmin: boolean;
}

const STATUS_CONFIG = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    className: "bg-yellow-50 text-yellow-600",
  },
  APPROVED: {
    label: "Approved",
    icon: CheckCircle,
    className: "bg-green-50 text-green-600",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-red-50 text-red-600",
  },
};

export function UploadsManager({
  uploads: initialUploads,
  isAdmin,
}: UploadsManagerProps) {
  const [uploads, setUploads] = useState(initialUploads);
  const [reviewingUpload, setReviewingUpload] = useState<Upload | null>(null);
  const [feedback, setFeedback] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? uploads
      : uploads.filter((u) => u.status === filter);

  async function handleReview(uploadId: string, status: "APPROVED" | "REJECTED") {
    try {
      const res = await fetch("/api/uploads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, status, feedback }),
      });

      if (res.ok) {
        setUploads(
          uploads.map((u) =>
            u.id === uploadId
              ? { ...u, status, feedback, reviewedAt: new Date().toISOString() }
              : u
          )
        );
        setReviewingUpload(null);
        setFeedback("");
        toast.success(`Upload ${status.toLowerCase()}`);
      }
    } catch {
      toast.error("Failed to update upload");
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes === 0) return "—";
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {["all", "PENDING", "APPROVED", "REJECTED"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f
                ? "bg-slate-800 text-white"
                : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
            )}
          >
            {f === "all" ? "All" : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG].label}
            {f !== "all" && (
              <span className="ml-1 text-xs">
                ({uploads.filter((u) => u.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Uploads list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <FileVideo className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-400">No uploads yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((upload) => {
            const statusConfig =
              STATUS_CONFIG[upload.status as keyof typeof STATUS_CONFIG];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={upload.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                    <FileVideo className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {upload.fileName}
                    </p>
                    <p className="text-xs text-slate-400">
                      @{upload.creator.handle} ·{" "}
                      {format(new Date(upload.createdAt), "MMM d, yyyy h:mm a")}{" "}
                      · {formatFileSize(upload.fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusConfig.className}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                  {isAdmin && upload.status === "PENDING" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReviewingUpload(upload);
                        setFeedback("");
                      }}
                    >
                      <MessageSquare className="mr-1 h-3.5 w-3.5" />
                      Review
                    </Button>
                  )}
                  {upload.feedback && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReviewingUpload(upload);
                        setFeedback(upload.feedback || "");
                      }}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review dialog */}
      <Dialog
        open={!!reviewingUpload}
        onOpenChange={(open) => !open && setReviewingUpload(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Upload</DialogTitle>
            <DialogDescription>
              {reviewingUpload?.fileName} by @{reviewingUpload?.creator.handle}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Feedback
              </label>
              <Textarea
                placeholder="Leave feedback for the creator..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
            </div>
            {reviewingUpload?.feedback &&
              reviewingUpload.status !== "PENDING" && (
                <p className="text-xs text-slate-400">
                  Reviewed{" "}
                  {reviewingUpload.reviewedAt &&
                    format(
                      new Date(reviewingUpload.reviewedAt),
                      "MMM d, yyyy"
                    )}
                </p>
              )}
          </div>
          {reviewingUpload?.status === "PENDING" && (
            <DialogFooter>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() =>
                  reviewingUpload &&
                  handleReview(reviewingUpload.id, "REJECTED")
                }
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() =>
                  reviewingUpload &&
                  handleReview(reviewingUpload.id, "APPROVED")
                }
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
