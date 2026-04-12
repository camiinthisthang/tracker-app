import { Sparkles } from "lucide-react";

export function ApplyHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft gradient background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-white to-emerald-50/40" />

      <div className="mx-auto max-w-4xl px-6 pb-16 pt-20 sm:pb-24 sm:pt-28">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
            Now hiring US-based creators
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Turn short-form content into{" "}
            <span className="bg-gradient-to-r from-blue-500 to-emerald-500 bg-clip-text text-transparent">
              real monthly income.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-slate-600 sm:text-lg">
            We&apos;re a UGC agency building a roster of US creators for our
            brand partners. We handle hooks, briefs, editing, and strategy. You
            show up, film once a week, and get paid.
          </p>

          {/* Quick stats */}
          <div className="mt-8 grid grid-cols-3 gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur sm:p-6">
            <div className="text-center">
              <p className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                $850
              </p>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                monthly base
              </p>
            </div>
            <div className="border-x border-slate-200 text-center">
              <p className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                1 day
              </p>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                filming per week
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                $5-10K+
              </p>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                top earners stacked
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <a
              href="#apply"
              className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              Start your application
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              See how it works →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
