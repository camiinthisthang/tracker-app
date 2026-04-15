"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  teamId: string;
  memberId?: string;
  inviteId?: string;
  label: string;
}

/**
 * Delete a TeamMember (manager) or a pending TeamInvite. Pass exactly one of
 * memberId or inviteId. Prompts for confirmation, then DELETEs the right
 * endpoint and refreshes the page.
 */
export function RemoveMemberButton({
  teamId,
  memberId,
  inviteId,
  label,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    const confirmed = window.confirm(
      `Remove ${label}? They'll lose access to this client immediately.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const url = memberId
        ? `/api/clients/${teamId}/members/${memberId}`
        : `/api/clients/${teamId}/invites/${inviteId}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Couldn't remove");
        return;
      }
      toast.success(`Removed ${label}`);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleRemove}
      disabled={loading}
      className="text-slate-400 hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
