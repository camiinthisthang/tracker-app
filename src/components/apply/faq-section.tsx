"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "Do I need professional gear?",
    a: "No. Your phone is enough. We actually prefer phone-shot content — it looks more authentic and performs better than polished studio content.",
  },
  {
    q: "Can I work on this part-time around a day job?",
    a: "Yes, if you can commit to one consistent shoot day per week and respond in the app within 24 hours on weekdays. Many of our creators are part-time / side income.",
  },
  {
    q: "What if I don't have an existing TikTok following?",
    a: "Not a problem — you'll create fresh accounts for this work anyway. We coach you through the first 14 days of building algorithmic trust on the new accounts.",
  },
  {
    q: "What if my content doesn't perform well?",
    a: "We give every creator 30 days of support with hook and format adjustments to find what works. Some creators take a bit to find their rhythm — that's normal. We only part ways after 60+ days of underperformance despite active adjustments.",
  },
  {
    q: "Can I keep posting to my personal accounts?",
    a: "Yes — the new accounts are just for client work. Your personal accounts stay yours.",
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
