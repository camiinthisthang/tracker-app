import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";

const TAX_FORM_BODY = `We need a completed tax form before your first payment. Pick whichever applies:

• W-9 (US residents / tax citizens): https://www.irs.gov/pub/irs-pdf/fw9.pdf
• W-8BEN (non-US): https://www.irs.gov/pub/irs-pdf/fw8ben.pdf

Fill it out and upload the completed PDF in the Uploads tab — pick "Onboarding documents" as the destination.`;

// TODO: templatize brand name — currently hard-coded to Chipped, the first client.
const FTC_WARMING_BODY = `Account Setup & FTC Compliance

Creators should create an 'incognito brand page' with a username format like name_chipped. Per FTC (Federal Trade Commission) guidelines, it's required to include clear disclosure that the account is affiliated with a company. This means adding a phrase like "[Chipped] partner" in the bio. Use a personal-style profile photo rather than a logo or brand asset to maintain authenticity.

Bio Options

These are casual, organic bios that feel personal and vibe-first:

• just a girl with good nails and better networking skills
• My nails went viral before my face did
• Built a better business card. Made it cute.
• I don't give out my number. I tap my nail.
• Pretty nails. Powerful tech. No one knows.
• They asked for my @. I gave them my nail.

Algorithm Training Workflow

Goal: Train TikTok's algorithm to understand the account as part of the beauty/lifestyle/social niche without immediately appearing as a brand.

1. Open TikTok and go to your For You Page (FYP).
2. Use the search bar to find content relevant to your niche.
3. Filter results by "Date Posted" and select "This Month".
4. Engage as your target user would. Like, comment, save, and share videos that align with your niche. Comment authentically, using phrasing your ideal audience would naturally say. For example:
   - wait this is so smart… have you tried chipped yet?
   - your nails are stunning, you'd love chipped! it's like a business card in your manicure
   - ok but imagine this with chipped nails… the tap would eat
   - you're exactly who chipped was made for tbh
   - deadass just tapped my nail and landed a collab. chipped is wild
   - girl if you love this, chipped would blow your mind
   - this plus chipped is how I've been meeting everyone lately
5. Follow relevant creators. Prioritize creators with aesthetic or talk-to-camera content who already engage with your target audience. Keep interacting with their content to train your FYP.
6. Repeat this entire loop 2–3 times a day for 2–3 days. Aim to follow and engage with 50–75 creators.`;

/**
 * Create the standard onboarding tasks for a freshly approved creator.
 * Idempotent — if an ONBOARDING task with the same title already exists for
 * this creator, it's skipped.
 */
export async function createOnboardingTasks(creatorId: string) {
  const now = new Date();
  const due = addDays(now, 7);

  const specs = [
    { title: "Submit your tax form", description: TAX_FORM_BODY },
    {
      title: "Account setup + FTC compliance",
      description: FTC_WARMING_BODY,
    },
  ];

  for (const spec of specs) {
    const existing = await prisma.task.findFirst({
      where: {
        creatorId,
        type: "ONBOARDING",
        title: spec.title,
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.task.create({
      data: {
        creatorId,
        type: "ONBOARDING",
        title: spec.title,
        description: spec.description,
        dueDate: due,
      },
    });
  }
}
