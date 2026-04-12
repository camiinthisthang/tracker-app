import { CheckCircle2 } from "lucide-react";

const earningsTable = [
  {
    scenario: "Quiet month — steady but no breakout",
    signups: "~100",
    earnings: "+$300/mo",
  },
  {
    scenario: "Solid consistent performance",
    signups: "~500",
    earnings: "+$1,500/mo",
  },
  {
    scenario: "One video goes viral",
    signups: "~2,000",
    earnings: "+$6,000/mo",
    highlight: true,
  },
  {
    scenario: "Multiple hit videos + strong CTAs",
    signups: "~4,000+",
    earnings: "+$12,000/mo",
  },
];

const stackingExample = [
  {
    label: "Client 1 (your first with us)",
    value: "$1,200 base + $1,500 perf",
    total: "$2,700",
  },
  { label: "Client 2 (referred)", value: "Retainer only", total: "$1,200" },
  {
    label: "Client 3 (referred)",
    value: "$1,500 + $800 perf",
    total: "$2,300",
  },
  { label: "Client 4 (referred)", value: "Retainer only", total: "$1,000" },
];

export function PaymentSection() {
  return (
    <section id="pay" className="border-t border-slate-100 py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            How you actually get paid
          </h2>
          <p className="mt-3 text-base text-slate-600">
            No vague promises. Here&apos;s the math.
          </p>
        </div>

        {/* Base + perf */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-slate-500">
                Base retainer
              </h3>
              <span className="text-xs text-slate-400">monthly</span>
            </div>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              $700–$1,800<span className="text-base font-normal text-slate-500">/mo</span>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Based on experience and past performance. Paid the 1st of each
              month for the previous month&apos;s work. Reviews every 90 days —
              strong performers step up.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-emerald-50 p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-blue-700">
                Performance bonus
              </h3>
              <span className="text-xs text-blue-600">per sign-up</span>
            </div>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              $1–$6<span className="text-base font-normal text-slate-500">/signup</span>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Every sign-up your content drives for a client. Stackable across
              multiple clients. Software pays more than free apps.
            </p>
          </div>
        </div>

        {/* Earnings table */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              What $3/signup actually looks like
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              On top of your monthly retainer.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {earningsTable.map((row) => (
              <div
                key={row.scenario}
                className={`flex items-center justify-between px-6 py-4 ${
                  row.highlight ? "bg-blue-50/50" : ""
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {row.scenario}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.signups} sign-ups generated
                  </p>
                </div>
                <p
                  className={`text-base font-semibold ${
                    row.highlight ? "text-blue-600" : "text-slate-900"
                  }`}
                >
                  {row.earnings}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Stacking */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-900 p-8 text-white">
          <h3 className="text-xl font-semibold">
            How top creators hit $5K–$10K+/month
          </h3>
          <p className="mt-2 text-sm text-slate-300">
            We run campaigns for multiple brand clients. Once you prove you can
            consistently deliver, we refer our top creators to additional
            clients in our network — so you can stack 3-5 active client
            relationships at the same time without hunting for work.
          </p>

          <div className="mt-6 space-y-2">
            {stackingExample.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{row.label}</p>
                  <p className="text-xs text-slate-400">{row.value}</p>
                </div>
                <p className="text-sm font-semibold text-emerald-400">
                  {row.total}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-4 py-3 ring-1 ring-emerald-500/30">
              <p className="text-sm font-semibold text-white">
                Realistic stacked total
              </p>
              <p className="text-lg font-semibold text-emerald-400">
                ~$7,200/mo
              </p>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 text-sm text-slate-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            Creators pulling $10K+ months typically run 4-5 clients with 1-2
            viral hits per month.
          </p>
        </div>
      </div>
    </section>
  );
}
