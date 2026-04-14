import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Users, Megaphone, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { InviteManagerButton } from "@/components/clients/invite-manager-button";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  await requireSuperAdmin();
  const { teamId } = await params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      settings: true,
      members: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      invites: {
        where: { acceptedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!team) notFound();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [creators, campaigns, recentPosts, viewsAgg] = await Promise.all([
    prisma.creator.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.campaign.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { _count: { select: { posts: true, campaignCreators: true } } },
    }),
    prisma.post.count({
      where: { creator: { teamId }, postedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.post.aggregate({
      where: { creator: { teamId } },
      _sum: { views: true, likes: true, comments: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title={team.name}
        description={`Client workspace · ${team.slug}`}
      >
        <InviteManagerButton teamId={team.id} teamName={team.name} />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Creators" value={creators.length} />
        <StatCard label="Campaigns" value={campaigns.length} />
        <StatCard label="Posts (30d)" value={recentPosts} />
        <StatCard
          label="Total views"
          value={(viewsAgg._sum.views ?? 0).toLocaleString()}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Managers */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              <UserPlus className="mr-2 inline h-4 w-4 text-slate-400" />
              Managers ({team.members.length})
            </h3>
          </div>
          {team.members.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              No managers yet. Invite one so this client can access their own
              campaigns and creators.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {team.members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">
                      {m.user.name || m.user.email}
                    </p>
                    <p className="text-xs text-slate-400">{m.user.email}</p>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 hover:opacity-90">
                    {m.role}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {team.invites.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Pending invites
              </p>
              <ul className="mt-2 space-y-2">
                {team.invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-amber-900">{inv.email}</p>
                      <p className="text-[10px] text-amber-700">
                        Sent {format(inv.createdAt, "MMM d")} · expires{" "}
                        {format(inv.expiresAt, "MMM d")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Campaigns */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              <Megaphone className="mr-2 inline h-4 w-4 text-slate-400" />
              Campaigns ({campaigns.length})
            </h3>
          </div>
          {campaigns.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              No campaigns yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {campaigns.map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <Link
                    href={`/campaigns/${c.id}/overview`}
                    className="block hover:opacity-80"
                  >
                    <p className="text-sm font-medium text-slate-700">
                      {c.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {c._count.campaignCreators} creator
                      {c._count.campaignCreators === 1 ? "" : "s"} ·{" "}
                      {c._count.posts} post
                      {c._count.posts === 1 ? "" : "s"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Creators */}
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              <Users className="mr-2 inline h-4 w-4 text-slate-400" />
              Creators ({creators.length})
            </h3>
          </div>
          {creators.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              No creators on this client yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {creators.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {c.name}
                    </p>
                    <p className="text-xs text-slate-400">@{c.handle}</p>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 hover:opacity-90">
                    {c.tier}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
