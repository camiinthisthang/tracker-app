import {
  MessageSquare,
  Scissors,
  CheckCircle2,
  LineChart,
  Lightbulb,
} from "lucide-react";

const items = [
  {
    icon: Lightbulb,
    title: "Hook strategy",
    description:
      "We write the hooks from data across hundreds of prior posts. You deliver them.",
  },
  {
    icon: MessageSquare,
    title: "Content guidance",
    description:
      "We tell you what types of videos are hitting right now per client — POV, listicles, demos, reactions.",
  },
  {
    icon: Scissors,
    title: "Editing",
    description:
      "We cut, add text overlays, match licensed trending audio, and polish the final output.",
  },
  {
    icon: CheckCircle2,
    title: "Review system",
    description:
      "Every edit gets QA'd by our team before it reaches you. Issues get caught early.",
  },
  {
    icon: LineChart,
    title: "Performance feedback",
    description:
      "We show you which hooks are winning, which are flat, and adjust the brief accordingly.",
  },
];

export function WhatWeHandle() {
  return (
    <section className="border-t border-slate-100 py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            The stuff we handle so you don&apos;t have to
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Most creators burn out trying to figure out what to post. Not your
            problem anymore.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              </div>
            );
          })}
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Your job
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              Show up, deliver the hooks with energy, approve the edits, and
              post.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
