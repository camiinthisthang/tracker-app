import { ApplicationForm } from "@/components/apply/application-form";
import { ApplyHero } from "@/components/apply/apply-hero";
import { OpportunitySection } from "@/components/apply/opportunity-section";
import { WorkflowSection } from "@/components/apply/workflow-section";
import { ExamplesSection } from "@/components/apply/examples-section";
import { PaymentSection } from "@/components/apply/payment-section";
import { WhoWereLookingFor } from "@/components/apply/who-were-looking-for";
import { WhatWeHandle } from "@/components/apply/what-we-handle";
import { FaqSection } from "@/components/apply/faq-section";
import { ApplyFooter } from "@/components/apply/apply-footer";
import { ApplyNav } from "@/components/apply/apply-nav";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = {
  title: `Apply to Become a Creator — ${BRAND_NAME}`,
  description:
    "Join our roster of US-based UGC creators. $850/month base + performance bonuses. Stack clients to earn $5K-$10K+/month.",
};

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-white">
      <ApplyNav />
      <ApplyHero />
      <OpportunitySection />
      <WorkflowSection />
      <ExamplesSection />
      <PaymentSection />
      <WhoWereLookingFor />
      <WhatWeHandle />
      <FaqSection />

      {/* Application Form */}
      <section id="apply" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Ready to apply?
            </h2>
            <p className="mt-3 text-base text-slate-600">
              We review applications within 3 business days. If we think
              you&apos;re a fit, we&apos;ll send a 15-min video call invite.
            </p>
          </div>
          <ApplicationForm />
        </div>
      </section>

      <ApplyFooter />
    </div>
  );
}
