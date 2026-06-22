"use client";

import { useState } from "react";
import { Phone, Trophy, Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NEXT_LABEL: Record<string, string> = {
  NEW: "Marked new",
  CONTACTED: "Marked contacted",
  WON: "Marked won",
  ARCHIVED: "Archived",
};

export function BrandInquiryActions({
  inquiryId,
  currentStatus,
}: {
  inquiryId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(status: string) {
    setLoading(status);
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error("Failed to update");
        return;
      }
      toast.success(NEXT_LABEL[status] || "Updated");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus !== "CONTACTED" && currentStatus !== "WON" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateStatus("CONTACTED")}
          disabled={loading !== null}
        >
          <Phone className="mr-1 h-3.5 w-3.5" />
          Contacted
        </Button>
      )}
      {currentStatus !== "WON" && (
        <Button
          variant="outline"
          size="sm"
          className="border-[color:var(--brand-blue)]/30 bg-[color:var(--brand-blue)]/5 text-[color:var(--brand-blue)] hover:bg-[color:var(--brand-blue)]/10"
          onClick={() => updateStatus("WON")}
          disabled={loading !== null}
        >
          <Trophy className="mr-1 h-3.5 w-3.5" />
          Won
        </Button>
      )}
      {currentStatus !== "ARCHIVED" && (
        <Button
          variant="outline"
          size="sm"
          className="text-slate-500"
          onClick={() => updateStatus("ARCHIVED")}
          disabled={loading !== null}
        >
          <Archive className="mr-1 h-3.5 w-3.5" />
          Archive
        </Button>
      )}
    </div>
  );
}
