import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import {
  ResourceManager,
  type ResourceRow,
} from "@/components/resources/resource-manager";

export default async function AdminResourcesPage() {
  const session = await getRequiredSession();

  const resources = await prisma.teamResource.findMany({
    where: { teamId: session.user.teamId },
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
