import { format } from "date-fns";
import { Building2, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAgencyAccess } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { BrandInquiryActions } from "@/components/brands/brand-inquiry-actions";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-[color:var(--brand-blue)]/10 text-[color:var(--brand-blue)]",
  CONTACTED: "bg-amber-50 text-amber-700",
  WON: "bg-green-50 text-green-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

export default async function BrandsPage() {
  await requireAgencyAccess();

  const inquiries = await prisma.brandInquiry.findMany({
    orderBy: { createdAt: "desc" },
  });

  const newCount = inquiries.filter((i) => i.status === "NEW").length;
  const contactedCount = inquiries.filter(
    (i) => i.status === "CONTACTED"
  ).length;
  const wonCount = inquiries.filter((i) => i.status === "WON").length;

  return (
    <div>
      <PageHeader
        title="Brand Inquiries"
        description="Inbound leads from the public /brands page"
      />

      {inquiries.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No brand inquiries yet"
          description="Inquiries from your /brands page will appear here."
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <StatCard label="Total" value={inquiries.length} />
            <StatCard label="New" value={newCount} />
            <StatCard label="Contacted" value={contactedCount} />
            <StatCard label="Won" value={wonCount} />
          </div>

          <div className="space-y-3">
            {inquiries.map((inq) => (
              <div
                key={inq.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {inq.company}
                      </h3>
                      <Badge
                        className={`${STATUS_COLORS[inq.status]} hover:opacity-90`}
                      >
                        {inq.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {inq.name}
                      {` · `}
                      {inq.email}
                      {inq.startWindow && ` · start: ${inq.startWindow}`}
                    </p>
                    {inq.link && (
                      <a
                        href={inq.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--brand-blue)] hover:underline"
                      >
                        {inq.link}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {format(inq.createdAt, "MMM d, yyyy")}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {inq.about}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <BrandInquiryActions
                    inquiryId={inq.id}
                    currentStatus={inq.status}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
