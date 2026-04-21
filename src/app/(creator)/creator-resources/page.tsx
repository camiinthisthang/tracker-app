import { BookOpen, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";

export default async function CreatorResourcesPage() {
  const session = await getRequiredSession();

  const resources = await prisma.teamResource.findMany({
    where: { teamId: session.user.teamId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Resources"
        description="Playbooks, guidelines, and tools your team has shared"
      />

      {resources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            Nothing here yet. Your manager will drop resources for you soon.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {resources.map((r) => (
            <a
              key={r.id}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-200 hover:bg-blue-50/30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600">
                    {r.title}
                  </h3>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                  {r.category && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {r.category}
                    </span>
                  )}
                </div>
                {r.description && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.description}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
