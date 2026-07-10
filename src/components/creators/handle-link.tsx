"use client";

import { ExternalLink } from "lucide-react";
import { platformProfileUrl } from "@/lib/constants";

/**
 * "Open profile" affordance next to a handle input — opens the platform
 * profile in a new tab. Renders nothing while the field is empty.
 */
export function HandleLink({
  platform,
  handle,
}: {
  platform: string;
  handle: string;
}) {
  const clean = handle.trim().replace(/^@+/, "");
  if (!clean) return null;
  return (
    <a
      href={platformProfileUrl(platform, clean)}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-600"
      title={`Open @${clean} in a new tab`}
    >
      Open
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
