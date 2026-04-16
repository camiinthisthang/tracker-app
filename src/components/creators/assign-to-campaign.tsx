"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
  isActive: boolean;
}

export function AssignToCampaign({
  creatorId,
  existingCampaignIds,
  campaigns,
}: {
  creatorId: string;
  existingCampaignIds: string[];
  campaigns: Campaign[];
}) {
  const router = useRouter();
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [loading, setLoading] = useState(false);

  const available = campaigns.filter(
    (c) => c.isActive && !existingCampaignIds.includes(c.id)
  );

  if (available.length === 0) return null;

  async function handleAssign() {
    if (!selectedCampaignId) {
      toast.error("Select a campaign");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/campaigns/${selectedCampaignId}/creators`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorId }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Could not assign");
        return;
      }
      toast.success("Creator assigned to campaign");
      setSelectedCampaignId("");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex items-end gap-2">
      <div className="flex-1">
        <Select
          value={selectedCampaignId}
          onValueChange={(v) => v && setSelectedCampaignId(v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Assign to campaign...">
              {available.find((c) => c.id === selectedCampaignId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {available.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <Megaphone className="mr-2 inline h-3 w-3 text-slate-400" />
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        className="h-8 bg-slate-900 text-white hover:bg-slate-800"
        onClick={handleAssign}
        disabled={loading || !selectedCampaignId}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Assign
      </Button>
    </div>
  );
}
