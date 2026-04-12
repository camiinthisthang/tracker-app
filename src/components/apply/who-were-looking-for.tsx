import { Check, X } from "lucide-react";

const lookingFor = [
  "US-based with US identification (required for tax)",
  "18+",
  "Comfortable on camera — energy and authenticity over perfection",
  "Native English speaker (or indistinguishably fluent)",
  "Can commit to one filming day per week, reliably, for at least 3 months",
  "Willing to create new IG/TikTok accounts specifically for this work",
  "Can distribute posting evenly — no bulk posting",
  "Responsive in our app (24hr turnaround on approvals during weekdays)",
];

const notLookingFor = [
  "Looking for a one-off brand deal rather than ongoing work",
  "Wanting to post this content on your existing personal account",
  "Only filming when inspiration strikes",
  "Uncomfortable following a brief / scripted hook",
  "Can't deliver a consistent shoot day",
];

export function WhoWereLookingFor() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Who we&apos;re looking for
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Be honest with yourself. Misalignment costs everyone time.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
            <h3 className="text-base font-semibold text-emerald-900">
              You&apos;re a strong fit if:
            </h3>
            <ul className="mt-4 space-y-2.5">
              {lookingFor.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="text-base font-semibold text-slate-900">
              You&apos;re probably NOT the right fit if:
            </h3>
            <ul className="mt-4 space-y-2.5">
              {notLookingFor.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span className="text-slate-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
