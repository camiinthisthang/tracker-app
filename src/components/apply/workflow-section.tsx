const steps = [
  {
    number: "01",
    title: "Weekly brief in the app",
    description:
      "Every week we drop your hooks, angles, and content direction into the app. What's working, what to try, what to avoid. All in one place.",
  },
  {
    number: "02",
    title: "Create the content on your own time",
    time: "Max flexibility",
    description:
      "Film whenever and however you want — early morning, late night, all at once, spread across the week. You handle the filming and any editing. No fixed shoot day.",
  },
  {
    number: "03",
    title: "Submit each video for review",
    description:
      "Upload finished videos to our app. We review and either approve, give notes, or ask for a re-shoot. Every video gets a green light before it goes live.",
  },
  {
    number: "04",
    title: "Cross-post to TikTok + Instagram",
    description:
      "Once approved, post the same video natively to both platforms from your phone. Same video, both accounts — maximum distribution.",
  },
  {
    number: "05",
    title: "Hit 60 videos per week",
    description:
      "That's ~8-9 videos a day on average. Distribute posts throughout the week — dumping all 60 at once hurts reach. Our app helps you pace it out.",
  },
  {
    number: "06",
    title: "All communication in the app",
    description:
      "Every question, note, review, and update flows through the app. No texting, no email threads, no DM chaos. One inbox, one source of truth.",
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
            Work on your own schedule. Everything runs through our app — no
            texting, no emails.
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
