"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

interface CampaignSwitcherProps {
  campaigns: { id: string; name: string; isActive: boolean }[];
  selectedId?: string;
  basePath: string;
  /** Other query params to keep when the campaign changes (range, week…). */
  preserve?: Record<string, string>;
}

export function CampaignSwitcher({
  campaigns,
  selectedId,
  basePath,
  preserve = {},
}: CampaignSwitcherProps) {
  const router = useRouter();
  const selected = campaigns.find((c) => c.id === selectedId);

  return (
    <Select
      value={selectedId ?? ALL}
      onValueChange={(v) => {
        if (!v) return;
        const q = new URLSearchParams(preserve);
        if (v !== ALL) q.set("campaign", v);
        const qs = q.toString();
        router.push(qs ? `${basePath}?${qs}` : basePath);
      }}
    >
      <SelectTrigger className="w-[220px]">
        <SelectValue>
          {selected ? selected.name : "All campaigns"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All campaigns</SelectItem>
        {campaigns.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
            {!c.isActive && " (ended)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
