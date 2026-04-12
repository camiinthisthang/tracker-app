const steps = [
  {
    number: "01",
    title: "Once a week: batch filming day",
    time: "2–3 hours",
    description:
      "Film everything for the week in one session: 4 talking videos + 10+ min of b-roll in 3 different settings/outfits.",
  },
  {
    number: "02",
    title: "Upload raw footage to our app",
    description:
      "That's it — you're done filming for the week. We take it from here.",
  },
  {
    number: "03",
    title: "Our editing team edits",
    description:
      "We cut your b-roll into short-form videos with text hooks + licensed music. 15+ posts per week.",
  },
  {
    number: "04",
    title: "You review in the app",
    description:
      "Every edit gets your approval before going live. Leave notes, request re-edits, or thumbs-up. Nothing posts without you.",
  },
  {
    number: "05",
    title: "You post natively",
    description:
      "Download the final video to your phone. Post to TikTok/Instagram/Facebook from your device — native posting matters for reach.",
  },
  {
    number: "06",
    title: "Distribute across the month",
    description:
      "2–3 posts per day, evenly spread. Our app queues them and tells you when to post what. Dumping all 60 at once kills reach.",
  },
];

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            How it actually works
          </h2>
          <p className="mt-3 text-base text-slate-600">
            One filming day per week. Everything else runs through our app.
          </p>
        </div>

        <div className="mt-14 space-y-5">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex gap-5 rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-slate-300"
            >
              <div className="shrink-0 text-2xl font-semibold text-slate-300">
                {step.number}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-semibold text-slate-900">
                    {step.title}
                  </h3>
                  {step.time && (
                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {step.time}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-slate-600">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
