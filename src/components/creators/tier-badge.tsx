import { Badge } from "@/components/ui/badge";
import { TIER_LABELS, TIER_COLORS } from "@/lib/constants";

interface TierBadgeProps {
  tier: string;
}

export function TierBadge({ tier }: TierBadgeProps) {
  return (
    <Badge
      variant="secondary"
      title="Tier is assigned manually by the team on the creator's profile — formal criteria coming later"
      className={`${TIER_COLORS[tier] || "bg-slate-100 text-slate-600"} cursor-help hover:opacity-90`}
    >
      {TIER_LABELS[tier] || tier}
    </Badge>
  );
}
