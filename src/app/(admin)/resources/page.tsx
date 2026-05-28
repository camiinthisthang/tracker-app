import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import {
  ResourceManager,
  type ResourceRow,
} from "@/components/resources/resource-manager";

export default async function AdminResourcesPage() {
  const session = await getRequiredSession();

  // Agency users see every team's resources so they can curate the full
  // shared library; client managers stay scoped to their own team.
  // Newly-added resources still land on session.user.teamId (the API default),
  // which means agency users write to the DropDeck agency team — i.e. shared
  // library by default. Adding per-team scoping at create time is a follow-up.
  const resources = await prisma.teamResource.findMany({
    where: hasAgencyWideAccess(session)
      ? {}
      : { teamId: session.user.teamId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const rows: ResourceRow[] = resources.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    description: r.description,
    category: r.category,
  }));

  return (
    <div>
      <PageHeader
        title="Resources"
        description="Manage the links creators see on their Resources tab"
      />
      <ResourceManager initial={rows} />
    </div>
  );
}
