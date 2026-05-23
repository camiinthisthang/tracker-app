import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CreatorSignupForm } from "@/components/creators/creator-signup-form";
import { BrandMark } from "@/components/brand/brand-mark";
import { BrandPageHeader } from "@/components/brand/brand-page-header";
import { BRAND_WORDMARK } from "@/lib/brand";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const creator = await prisma.creator.findUnique({
    where: { inviteToken: token },
    include: {
      team: { select: { name: true } },
      campaignCreators: {
        include: { campaign: { select: { name: true, isActive: true } } },
      },
    },
  });

  if (!creator) notFound();

  const activeCampaigns = creator.campaignCreators
    .filter((cc) => cc.campaign.isActive)
    .map((cc) => cc.campaign.name);

  return (
    <div className="brand-surface flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 pt-6">
        <BrandPageHeader section={`${BRAND_WORDMARK} / invite`} tone="light" />
        <div className="mt-6">
          <BrandMark href="/apply" tone="light" size="sm" />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-wider text-white/70">
              creator invite
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight lowercase text-white">
              you&apos;re in
              <span className="text-[var(--brand-chartreuse)]">.</span>
            </h1>
            <p className="mt-4 font-mono text-sm text-white/85">
              <span className="text-white">{creator.team.name}</span> just
              invited{" "}
              <span className="text-white">@{creator.handle}</span> to join as a
              creator.
            </p>
            {activeCampaigns.length > 0 && (
              <p className="mt-3 font-mono text-xs text-white/60">
                active campaigns: {activeCampaigns.join(", ").toLowerCase()}
              </p>
            )}
          </div>

          <CreatorSignupForm
            token={token}
            creatorName={creator.name}
          />
        </div>
      </div>
      <footer className="mx-auto w-full max-w-6xl px-6 pb-6 font-mono text-xs text-white/60">
        {BRAND_WORDMARK}. ugc campaign management.
      </footer>
    </div>
  );
}
