"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Soft fire/rehire a creator. Flips Creator.isActive without deleting any
 * history (posts, earnings, campaign assignments stay). Hides them from the
 * tracking/attention pages everywhere — their accounts KEEP SYNCING so viral
 * posts are still caught. To deactivate on just one campaign, use the
 * campaign roster's Active switch instead; to stop a scrape, deactivate the
 * handle in Social accounts.
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
      title={
        isActive
          ? "Hide this creator from tracking pages everywhere (all campaigns). Their accounts keep syncing so viral posts are still caught. For one campaign only, use that campaign's Active switch; to stop a scrape, deactivate the handle in Social accounts."
          : "Bring this creator back onto the tracking pages"
      }
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
