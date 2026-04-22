import { notFound } from "next/navigation";
import { format } from "date-fns";
import { UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAgencyAccess, AGENCY_TEAM_NAME } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { InviteManagerButton } from "@/components/clients/invite-manager-button";
import { RemoveMemberButton } from "@/components/clients/remove-member-button";

export default async function AgencyTeamPage() {
  await requireAgencyAccess();

  const team = await prisma.team.findFirst({
    where: { name: AGENCY_TEAM_NAME },
    include: {
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

  return (
    <div>
      <PageHeader
        title="Agency team"
        description={`Members of ${team.name} with cross-client visibility. Invite agency admins here — for a client-side manager, go to the client's page on /clients instead.`}
      >
        <InviteManagerButton
          teamId={team.id}
          teamName={team.name}
          variant="agency"
        />
      </PageHeader>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">
            <UserPlus className="mr-2 inline h-4 w-4 text-slate-400" />
            Members ({team.members.length})
          </h3>
        </div>
        {team.members.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">
            No members yet. Invite yourself or a teammate to seed the agency
            team.
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
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-50 text-indigo-700 hover:opacity-90">
                    Agency admin
                  </Badge>
                  {m.user.isSuperAdmin && (
                    <Badge className="bg-amber-50 text-amber-700 hover:opacity-90">
                      Super admin
                    </Badge>
                  )}
                  <Badge className="bg-slate-100 text-slate-600 hover:opacity-90">
                    {m.role}
                  </Badge>
                  <RemoveMemberButton
                    teamId={team.id}
                    memberId={m.id}
                    label={m.user.name || m.user.email}
                  />
                </div>
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
                  <RemoveMemberButton
                    teamId={team.id}
                    inviteId={inv.id}
                    label={`invite for ${inv.email}`}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
