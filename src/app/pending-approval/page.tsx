import { Mail, Clock } from "lucide-react";
import { getSession } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function PendingApprovalPage() {
  const session = await getSession();
  const email = session?.user?.email;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
          <Clock className="h-6 w-6 text-amber-600" />
        </div>
        <h1 className="text-center text-lg font-semibold text-slate-800">
          You&apos;re signed in — now waiting on an invite
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          We don&apos;t have a client workspace set up for{" "}
          {email ? <strong>{email}</strong> : "your account"} yet.
        </p>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700">What happens next?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            <li>
              If you applied to be a creator, we&apos;ll send your invite after
              your onboarding call.
            </li>
            <li>
              If you&apos;re a client manager, check your inbox for an invite
              email with a link that looks like{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5 text-[11px]">
                /invite/team/…
              </code>
            </li>
            <li>Already expecting access? Ping Cami and she&apos;ll sort it.</li>
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <a
            href="mailto:hey@dropdeck.xyz"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <Mail className="h-3.5 w-3.5" />
            Email support
          </a>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
