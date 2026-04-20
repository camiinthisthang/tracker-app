import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PostHogOnboardingForm } from "@/components/onboarding/posthog-onboarding-form";

export default async function PostHogOnboardingPage() {
  const session = await getRequiredSession();

  // Creators never see this; they don't have a client-team context.
  if (session.user.role === "CREATOR") {
    redirect("/home");
  }

  const settings = await prisma.teamSettings.findUnique({
    where: { teamId: session.user.teamId },
    select: {
      posthogApiKey: true,
      posthogProjectId: true,
      posthogHost: true,
    },
  });

  // Already configured — no reason to re-onboard; skip them past.
  if (settings?.posthogApiKey) {
    redirect("/dashboard");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
          <BarChart3 className="h-6 w-6 text-blue-600" />
        </div>
        <h1 className="text-xl font-semibold text-slate-800">
          Connect PostHog
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Paste your PostHog API key + project ID so we can attribute signups
          and paid conversions back to your creators.
        </p>
      </div>

      <PostHogOnboardingForm
        initialProjectId={settings?.posthogProjectId ?? ""}
        initialHost={settings?.posthogHost ?? ""}
      />
    </div>
  );
}
