import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AcceptTeamInviteForm } from "@/components/clients/accept-team-invite-form";

export default async function AcceptTeamInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: { team: true },
  });

  if (!invite) notFound();

  if (invite.acceptedAt) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm text-slate-500">
          This invite has already been accepted. Please{" "}
          <a href="/login" className="font-medium text-blue-600">
            sign in
          </a>{" "}
          to continue.
        </p>
      </div>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm text-red-600">
          This invite has expired. Ask the agency to send a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">
            You&apos;re invited to {invite.team.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Set up your account to access the {invite.team.name} workspace on
            Viewtrackr.
          </p>
        </div>
        <AcceptTeamInviteForm token={token} email={invite.email} />
      </div>
    </div>
  );
}
