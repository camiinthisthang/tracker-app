import Link from "next/link";
import { format } from "date-fns";
import { Building2, Plus, Users, Megaphone, Film } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAgencyAccess, AGENCY_TEAM_SLUGS } from "@/lib/auth";
import { BRAND_NAME } from "@/lib/brand";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";

export default async function ClientsPage() {
  await requireAgencyAccess();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const teams = await prisma.team.findMany({
    // Exclude the agency team from the clients list — it's managed separately
    // on /team. Identified by slug so a display-name rename doesn't break it.
    where: { slug: { notIn: AGENCY_TEAM_SLUGS } },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          creators: true,
          campaigns: true,
          members: true,
        },
      },
    },
  });

  // Aggregate post counts + most recent activity per team in parallel
  const engagement = await Promise.all(
    teams.map(async (team) => {
      const [recentPosts, totalViews, lastPost] = await Promise.all([
        prisma.post.count({
          where: {
            creator: { teamId: team.id },
            postedAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.post.aggregate({
          where: { creator: { teamId: team.id } },
          _sum: { views: true },
        }),
        prisma.post.findFirst({
          where: { creator: { teamId: team.id } },
          orderBy: { postedAt: "desc" },
          select: { postedAt: true },
        }),
      ]);
      return {
        teamId: team.id,
        recentPosts,
        totalViews: totalViews._sum.views ?? 0,
        lastActiveAt: lastPost?.postedAt ?? null,
      };
    })
  );

  const totalCreators = teams.reduce((s, t) => s + t._count.creators, 0);
  const totalCampaigns = teams.reduce((s, t) => s + t._count.campaigns, 0);
  const totalPosts30d = engagement.reduce((s, e) => s + e.recentPosts, 0);

  return (
    <div>
      <PageHeader
        title="Clients"
        description={`All client brands using ${BRAND_NAME}. Create new clients and invite their managers.`}
      >
        <Link href="/clients/new">
          <Button className="bg-slate-900 text-white hover:bg-slate-800">
            <Plus className="mr-2 h-4 w-4" />
            New client
          </Button>
        </Link>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Clients" value={teams.length} />
        <StatCard label="Creators" value={totalCreators} />
        <StatCard label="Campaigns" value={totalCampaigns} />
        <StatCard label="Posts (30d)" value={totalPosts30d} />
      </div>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <Building2 className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No clients yet</p>
          <Link href="/clients/new">
            <Button variant="outline" className="mt-4">
              Create your first client
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Creators</th>
                <th className="px-5 py-3">Campaigns</th>
                <th className="px-5 py-3">Posts (30d)</th>
                <th className="px-5 py-3">Total views</th>
                <th className="px-5 py-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teams.map((team) => {
                const eng = engagement.find((e) => e.teamId === team.id)!;
                return (
                  <tr
                    key={team.id}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/clients/${team.id}`}
                        className="block"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                            <Building2 className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">
                              {team.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {team._count.members} member
                              {team._count.members === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {team._count.creators}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Megaphone className="h-3.5 w-3.5 text-slate-400" />
                        {team._count.campaigns}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Film className="h-3.5 w-3.5 text-slate-400" />
                        {eng.recentPosts}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {eng.totalViews.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {eng.lastActiveAt
                        ? format(eng.lastActiveAt, "MMM d, yyyy")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
