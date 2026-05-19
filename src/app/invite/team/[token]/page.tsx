import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AcceptTeamInviteForm } from "@/components/clients/accept-team-invite-form";
import { BrandMark } from "@/components/brand/brand-mark";
import { BrandPageHeader } from "@/components/brand/brand-page-header";

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
      <FallbackShell heading="already accepted">
        <p className="font-mono text-sm text-white/85">
          this invite has already been accepted.{" "}
          <a
            href="/login"
            className="font-medium text-[var(--brand-chartreuse)] underline-offset-4 hover:underline"
          >
            sign in
          </a>{" "}
          to continue.
        </p>
      </FallbackShell>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <FallbackShell heading="invite expired">
        <p className="font-mono text-sm text-white/85">
          this invite has expired. ask the agency to send a new one.
        </p>
      </FallbackShell>
    );
  }

  return (
    <div className="brand-surface flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 pt-6">
        <BrandPageHeader section="viewtrackr / team invite" tone="light" />
        <div className="mt-6">
          <BrandMark href="/apply" tone="light" size="sm" />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-wider text-white/70">
              team invite
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight lowercase text-white">
              welcome to{" "}
              <span className="text-[var(--brand-chartreuse)]">
                {invite.team.name.toLowerCase()}.
              </span>
            </h1>
            <p className="mt-4 font-mono text-sm text-white/85">
              set up your account to access the {invite.team.name} workspace on
              viewtrackr.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-2xl">
            <AcceptTeamInviteForm token={token} email={invite.email} />
          </div>
        </div>
      </div>
      <footer className="mx-auto w-full max-w-6xl px-6 pb-6 font-mono text-xs text-white/60">
        viewtrackr. ugc campaign management.
      </footer>
    </div>
  );
}

function FallbackShell({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="brand-surface flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 pt-6">
        <BrandPageHeader section="viewtrackr / team invite" tone="light" />
        <div className="mt-6">
          <BrandMark href="/apply" tone="light" size="sm" />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold tracking-tight lowercase text-white">
            {heading}
            <span className="text-[var(--brand-chartreuse)]">.</span>
          </h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
