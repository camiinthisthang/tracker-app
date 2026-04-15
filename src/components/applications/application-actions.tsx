"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ApplicationActions({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(status: string) {
    setLoading(status);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error("Failed to update");
        return;
      }

      const data = await res.json().catch(() => null);

      if (status === "APPROVED" && data?.createdCreatorId) {
        toast.success("Creator created — opening their profile", {
          description: data.inviteToken
            ? `Invite URL copied: /invite/${data.inviteToken}`
            : undefined,
          duration: 6000,
        });
        if (data.inviteToken) {
          navigator.clipboard
            ?.writeText(
              `${window.location.origin}/invite/${data.inviteToken}`
            )
            .catch(() => {});
        }
        router.push(`/creators/${data.createdCreatorId}`);
        return;
      }

      if (status === "APPROVED" && data?.createWarning) {
        toast.warning(data.createWarning);
      } else {
        toast.success(`Application marked ${status.toLowerCase()}`);
      }
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus !== "APPROVED" && (
        <Button
          variant="outline"
          size="sm"
          className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
          onClick={() => updateStatus("APPROVED")}
          disabled={loading !== null}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          Approve
        </Button>
      )}
      {currentStatus !== "REJECTED" && (
        <Button
          variant="outline"
          size="sm"
          className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          onClick={() => updateStatus("REJECTED")}
          disabled={loading !== null}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Reject
        </Button>
      )}
    </div>
  );
}
