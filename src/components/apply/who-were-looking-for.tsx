import { Check, X } from "lucide-react";

const lookingFor = [
  "US-based with US identification (required for tax)",
  "18+",
  "Comfortable on camera — energy and authenticity over perfection",
  "Native English speaker (or indistinguishably fluent)",
  "Can consistently deliver 60 videos per month for at least 3 months",
  "Willing to create new IG and TikTok accounts specifically for this work",
  "Okay cross-posting every video to both platforms",
  "Comfortable running all communication through the app (no texting, no emails)",
  "Responsive in-app — 24hr turnaround on reviews and feedback on weekdays",
];

const notLookingFor = [
  "Looking for a one-off brand deal rather than ongoing work",
  "Wanting to post this content on your existing personal account",
  "Expecting us to film, edit, or produce the videos for you",
  "Need to text/call/email back and forth instead of using the app",
  "Can't commit to the 60-video-per-month volume consistently",
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
