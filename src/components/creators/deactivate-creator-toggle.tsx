"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Soft fire/rehire a creator. Flips Creator.isActive without deleting any
 * history (posts, earnings, campaign assignments stay). Use this instead of
 * the Danger zone delete when you just want to stop tracking someone.
 */
export function DeactivateCreatorToggle({
  creatorId,
  isActive,
}: {
  creatorId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Failed to update");
      }
      toast.success(isActive ? "Creator deactivated" : "Creator reactivated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={saving}
      className={
        isActive
          ? "text-slate-600"
          : "border-[color:var(--brand-blue)]/30 bg-[color:var(--brand-blue)]/5 text-[color:var(--brand-blue)]"
      }
    >
      <Power className="mr-1.5 h-4 w-4" />
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
