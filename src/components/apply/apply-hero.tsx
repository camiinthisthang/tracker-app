import { BrandHeadline } from "@/components/brand/brand-headline";
import { BrandMark } from "@/components/brand/brand-mark";
import { BrandPageHeader } from "@/components/brand/brand-page-header";
import { BRAND_WORDMARK } from "@/lib/brand";

export function ApplyHero() {
  return (
    <section className="brand-surface relative overflow-hidden">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-10 sm:pb-28 sm:pt-12">
        {/* Terminal-log header bar — matches the Poncho deck page chrome */}
        <BrandPageHeader
          section={`${BRAND_WORDMARK} / apply`}
          index="01 / 04"
          tone="light"
        />

        {/* Wordmark sits below the page header, slightly inset */}
        <div className="mt-10 flex items-center gap-3">
          <BrandMark tone="light" size="sm" href="/apply" />
          <span className="brand-label">
            now hiring US-based creators.
          </span>
        </div>

        {/* Headline — Geist Bold lowercase, chartreuse highlight on the
            verb that does the work. */}
        <div className="mt-12 max-w-4xl">
          <BrandHeadline size="xl" highlight="portfolio." tone="light">
            work when you want. build a real
          </BrandHeadline>
        </div>

        <p className="mt-8 max-w-2xl font-mono text-sm text-white/85 sm:text-base">
          we&apos;re a ugc agency building a roster of us creators for our brand
          partners. we hand you hooks, direction, and a review process. you
          create, cross-post, and grow a portfolio that lands more clients.
        </p>

        {/* Quick stats — terminal log style, lowercase, mono labels */}
        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/20 sm:grid-cols-3">
          <StatBlock value="$700–$1.8k" label="monthly retainer" />
          <StatBlock value="60/month" label="videos cross-posted" />
          <StatBlock value="$5–10k+" label="top earners stacked" />
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <a
            href="#apply"
            className="rounded-md bg-[var(--brand-chartreuse)] px-6 py-3 font-mono text-sm font-medium text-[#0a0a0a] hover:opacity-90"
          >
            start your application →
          </a>
          <a
            href="#how-it-works"
            className="font-mono text-sm text-white/85 underline-offset-4 hover:underline"
          >
            see how it works
          </a>
        </div>
      </div>
    </section>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[var(--brand-blue)] px-6 py-7">
      <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {value}
      </p>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-white/70">
        {label}
      </p>
    </div>
  );
}
