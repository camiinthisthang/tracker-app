"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";

/** On/off switch for the crosspost audit's YouTube Shorts leg. State lives in
 * the URL (?ytAudit=1) so the server-rendered audit recomputes on change. */
export function YtAuditToggle({
  campaignId,
  enabled,
}: {
  campaignId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2">
      <span className="text-xs font-medium text-slate-600">
        Include YT Shorts
      </span>
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={(checked) => {
          setPending(true);
          router.push(
            checked
              ? `/campaigns/${campaignId}/overview?ytAudit=1`
              : `/campaigns/${campaignId}/overview`,
            { scroll: false }
          );
        }}
      />
    </label>
  );
}
