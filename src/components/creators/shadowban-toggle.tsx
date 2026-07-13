"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Flags a creator as shadow-banned: they show a distinct flag and are
 * excluded from pacing so the ban isn't mistaken for falling behind.
 */
export function ShadowbanToggle({
  creatorId,
  isShadowbanned,
}: {
  creatorId: string;
  isShadowbanned: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isShadowbanned: !isShadowbanned }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Failed to update");
      }
      toast.success(
        isShadowbanned
          ? "Shadow-ban flag cleared — back in pacing"
          : "Marked shadow-banned — excluded from pacing",
      );
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
      title="Rare, whole-creator flag: excludes them from pacing entirely. For a single banned handle, use Mark SB on that handle in Social accounts instead — pacing then continues on their other handles."
      className={
        isShadowbanned
          ? "border-violet-200 bg-violet-50 text-violet-600"
          : "text-slate-600"
      }
    >
      <EyeOff className="mr-1.5 h-4 w-4" />
      {isShadowbanned ? "Clear shadow-ban" : "Mark shadow-banned"}
    </Button>
  );
}
