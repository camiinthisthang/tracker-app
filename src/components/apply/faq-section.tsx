"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "Do I have to film on a set schedule?",
    a: "Nope — that's the whole point. Film whenever you want, as often as you want. Early mornings, late nights, big batches on the weekend, or 10-minute stretches between other work. We only care that you hit the 60/week target and the videos clear our review.",
  },
  {
    q: "Do you edit my videos for me?",
    a: "No. You create and edit the videos yourself. We give you the hooks, angles, and content direction — and we review every video before you post it. If you need feedback on a cut or want us to flag something, that all happens in the review in our app.",
  },
  {
    q: "What does 'cross-post to TikTok and Instagram' mean exactly?",
    a: "Every video you create gets posted to both your TikTok account and your Instagram account — same video, both platforms, posted natively from your phone. This doubles your reach without doubling your work.",
  },
  {
    q: "Do I need professional gear?",
    a: "No. Your phone is enough. We actually prefer phone-shot content — it looks more authentic and performs better than polished studio content.",
  },
  {
    q: "Why does everything have to be in the app?",
    a: "Because agencies who run communication through texts and DMs burn out both sides. Everything in the app means: one source of truth, every note saved, every review traceable, no lost messages, no crossed wires. It keeps us fast and you sane.",
  },
  {
    q: "Can I work on this part-time around a day job?",
    a: "Yes — with the flexibility built in, tons of our best creators are doing this alongside day jobs. You just need to hit the weekly volume and keep up with reviews in-app within 24hrs on weekdays.",
  },
  {
    q: "What if I don't have an existing TikTok or Instagram following?",
    a: "Not a problem — you'll create fresh accounts for this work anyway. We coach you through building algorithmic trust on the new accounts in the first 14 days.",
  },
  {
    q: "Can I keep posting to my personal accounts?",
    a: "Yes — the new accounts are just for client work. Your personal accounts stay yours.",
  },
  {
    q: "What if my content doesn't perform well?",
    a: "We give every creator 30 days of support with hook and format adjustments to find what works. Some creators take a bit to find their rhythm — that's normal. We only part ways after 60+ days of underperformance despite active adjustments.",
  },
  {
    q: "How long until I see my first paycheck?",
    a: "First retainer payment lands on the 1st of the month following your first completed month of work. So if you start mid-January, your first $850 lands February 1st.",
  },
  {
    q: "Do you work with creators outside the US?",
    a: "Not currently — our clients specifically want US-based creators for this round.",
  },
  {
    q: "What payment methods do you use?",
    a: "PayPal or direct bank transfer on the 1st of each month. We'll send you a W-9 during onboarding (5 minutes to complete). At year-end, if you earn over $600, we send you a 1099-NEC.",
  },
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Frequently asked
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Everything we get asked before someone signs on.
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={faq.q}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
              >
                <span className="text-sm font-medium text-slate-900">
                  {faq.q}
                </span>
                {openIdx === i ? (
                  <Minus className="h-4 w-4 shrink-0 text-slate-500" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-slate-500" />
                )}
              </button>
              {openIdx === i && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                  <p className="text-sm leading-relaxed text-slate-600">
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
