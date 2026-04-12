import {
  DollarSign,
  Zap,
  Video,
  Calendar,
  Gift,
  TrendingUp,
} from "lucide-react";

const items = [
  {
    icon: DollarSign,
    title: "$850/month retainer",
    description:
      "Paid monthly. Top performers step up to $1,000/month after 90 days.",
  },
  {
    icon: TrendingUp,
    title: "Performance bonuses",
    description:
      "$1–$6 per sign-up your content drives. Stackable across clients.",
  },
  {
    icon: Video,
    title: "60 videos / month",
    description:
      "About 15/week, filmed in one batch session and posted natively.",
  },
  {
    icon: Zap,
    title: "We handle the work",
    description:
      "Hooks, briefs, product info, music, and editing — all done for you.",
  },
  {
    icon: Calendar,
    title: "Fresh accounts",
    description:
      "Not your personal IG/TikTok. We'll guide you through setting up new ones.",
  },
  {
    icon: Gift,
    title: "Client stacking",
    description:
      "Established creators earn $5K–$10K/month across 3-5 client relationships.",
  },
];

export function OpportunitySection() {
  return (
    <section className="border-t border-slate-100 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            What&apos;s on the table
          </h2>
          <p className="mt-3 text-base text-slate-600">
            We&apos;ve done this with dozens of creators. Here&apos;s exactly
            what you&apos;re signing up for.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-slate-300"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
