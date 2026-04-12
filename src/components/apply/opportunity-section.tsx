import {
  DollarSign,
  Zap,
  Video,
  Clock,
  MessageCircle,
  Briefcase,
} from "lucide-react";

const items = [
  {
    icon: DollarSign,
    title: "$850/month retainer",
    description:
      "Paid monthly. Top performers step up to $1,000/month after 90 days.",
  },
  {
    icon: Zap,
    title: "Performance bonuses",
    description:
      "$1–$6 per sign-up your content drives. Stackable across clients.",
  },
  {
    icon: Video,
    title: "60 videos per week",
    description:
      "Cross-posted to both your TikTok and Instagram accounts. That's the target — how you hit it is up to you.",
  },
  {
    icon: Clock,
    title: "Maximum flexibility",
    description:
      "No fixed shoot day. Work whenever, as often as you want. Film at 3am or across 10-minute breaks — we don't care how.",
  },
  {
    icon: MessageCircle,
    title: "Everything in the app",
    description:
      "Briefs, hooks, reviews, feedback, pay — all inside our app. No texts, no email threads, no DMs.",
  },
  {
    icon: Briefcase,
    title: "Build your portfolio",
    description:
      "Top creators get referred to our other brand partners. Stack clients and turn this into a real career.",
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
