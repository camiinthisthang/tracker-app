"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", segment: "overview" },
  { label: "Reports", segment: "reports" },
  { label: "Notifications", segment: "notifications" },
  { label: "Tasks", segment: "tasks" },
  // Uploads hidden until R2 is configured — see CLAUDE.md TODO and the audit doc.
  // { label: "Uploads", segment: "uploads" },
];

export default function CampaignDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const campaignId = params.campaignId as string;

  return (
    <div>
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => {
            const href = `/campaigns/${campaignId}/${tab.segment}`;
            const isActive = pathname.includes(`/${tab.segment}`);
            return (
              <Link
                key={tab.segment}
                href={href}
                className={cn(
                  "border-b-2 pb-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-slate-800 text-slate-800"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
