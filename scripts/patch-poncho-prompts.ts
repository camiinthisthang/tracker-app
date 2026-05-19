/**
 * Backfill Poncho prompts for the 20 most-recent hooks that don't have one.
 *
 * Each entry below is keyed by the hook's existing id (from prod). The script
 * only writes when `ponchoPrompt` is currently null — so re-running is safe,
 * and if Cami / Jacqueline have edited a prompt by hand in the meantime, we
 * won't clobber it.
 *
 * Style of every prompt:
 *   - [BRACKETS] for variables the creator fills in
 *   - names specific Poncho tools / data sources when relevant (apollo,
 *     hunter, clado, exa, firecrawl, levels.fyi, glassdoor, npi registry,
 *     stableface, purch, etc)
 *   - asks for a structured output (one-page brief, side-by-side, ranked
 *     list, green/yellow/red verdict)
 *   - sets a spend cap where it makes sense
 *
 * Usage:
 *   DATABASE_URL="<prod>" npx tsx scripts/patch-poncho-prompts.ts          # dry run
 *   DATABASE_URL="<prod>" npx tsx scripts/patch-poncho-prompts.ts --confirm
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

interface Patch {
  hookId: string;
  note: string;
  ponchoPrompt: string;
}

const PATCHES: Patch[] = [
  // ─── REGAN BATCH (May 9 + May 7) ─────────────────────────────────────

  {
    hookId: "cmoyps6u3000705l5ckn9zq0z",
    note: "quit agency job → 6 clients april",
    ponchoPrompt:
      "my agency sells [SERVICE] to [ICP]. find me 50 new prospects this week. cross-check apollo, clado, and linkedin for anyone matching [ICP CRITERIA]. enrich every lead with verified email through hunter and one personalization hook (recent funding, recent hire, or recent linkedin post). draft a cold email for each one in my voice — short, no pleasantries. stage them for me to approve before send. show running cost and projected reply rate at the end.",
  },
  {
    hookId: "cmoypqmxj000605l54se7ulkt",
    note: "he said 6'2 / poncho said 5'10",
    ponchoPrompt:
      "i'm uploading a photo where someone is standing next to a reference object (door frame, stop sign, parking meter, car, doorway). estimate their actual height by measuring against the known dimensions of that object. give me: the estimated height, your confidence level (1-10), and the reference points you used. one-line verdict at the top. [attach photo]",
  },
  {
    hookId: "cmoypjqce000405l5tosj799v",
    note: "$1500 logo → $4 in 12 seconds",
    ponchoPrompt:
      "design me a logo for [BUSINESS NAME], a [INDUSTRY] business. style: [minimalist / playful / luxury / vintage / editorial]. generate 6 variations. each one needs a primary wordmark, a standalone icon mark, and a one-color version. export at 1024x1024 in SVG + PNG, host at a sharable URL, and include favicon-sized exports. spend cap: $5.",
  },
  {
    hookId: "cmoypg4wa000305l5xhjmrqbd",
    note: "PLEASE run your future roommate",
    ponchoPrompt:
      "i'm about to sign a lease with [ROOMMATE NAME], age [AGE], in [CITY]. pull eviction records, small claims court filings, prior addresses (last 5 years), employer if public, any landlord-tenant review sites, and reddit r/[city] mentions. render a one-page brief with a green/yellow/red rating and the 5 questions i should ask them before signing.",
  },
  {
    hookId: "cmoype4h8000105l5v6l0ikhy",
    note: "800 followers → first paid brand deal",
    ponchoPrompt:
      "i'm a creator with [N] followers on [PLATFORM]. my content covers [TOPICS]. my audience is mostly [DEMOGRAPHIC]. find me 20 brands whose target customer matches my audience. for each: brand name, the marketing or influencer manager's verified email (run through hunter), and a 3-line personalized pitch i can paste. rank by likelihood of saying yes — prioritize brands that have sponsored creators under 10k followers in the last 6 months.",
  },
  {
    hookId: "cmoynuwbr000304l8oj5m7k26",
    note: "middle school best friend in 6s",
    ponchoPrompt:
      "help me find someone i lost touch with. first name: [NAME]. last name (if i remember): [NAME]. school: [SCHOOL] in [CITY]. graduation year: roughly [YEAR]. one detail i remember about them: [DETAIL]. cross-check linkedin, facebook, instagram, twitter/x, and any school alumni pages. give me the 3 most likely matches with their current city, employer if visible, and the profile link. rank by likelihood.",
  },
  {
    hookId: "cmoynt53o000204l8l6o38f8c",
    note: "$90k → countered $135k → they paid",
    ponchoPrompt:
      "i just got an offer for [ROLE] at [COMPANY] in [CITY]. base is [$X], equity is [Y%]. cross-check levels.fyi, glassdoor, blind, comprehensive.io, and pavilion comp data for this exact role + level + city. also: pull the recruiter's name from the offer email and estimate their own comp based on the same sources. produce a counter-offer email anchored on the 75th percentile number plus the two lines i should say on the negotiation call.",
  },
  {
    hookId: "cmoynr41e000104l88r9lm4bw",
    note: "girls before you let any man in",
    ponchoPrompt:
      "someone i don't know is coming to my apartment. phone number: [PHONE]. name they gave me: [NAME]. occupation they gave: [OCCUPATION — handyman / locksmith / mover / etc]. cross-check public records, business registrations tied to this phone number, the national sex offender registry, and any reviews of their business. one-line verdict at the top: green / yellow / red. flag the top 2 concerns if any.",
  },
  {
    hookId: "cmoynpb87000004l85wqestgk",
    note: "hinge said 'founder'",
    ponchoPrompt:
      "i'm uploading a screenshot of a dating app profile. they say their name is [NAME], age [AGE], and they're a [ROLE] at [COMPANY]. verify the claim. open linkedin, x/twitter, instagram, and any public mention of them at that company in the last 12 months. flag inconsistencies: wrong title, wrong company, no public footprint, last activity at the company more than 6 months ago. one-line verdict at the top.",
  },
  {
    hookId: "cmovq97mr000004kze0kiiuvj",
    note: "this should be illegal / pedro pascal email",
    ponchoPrompt:
      "pull the best public contact path for [PUBLIC FIGURE NAME]. include: their publicist's email, their manager's email, their agency's general inbound, and their PR firm's media contact. exclude personal social DMs and personal email. for each contact: name + role + which firm + a verification source. one-line summary at the top: \"the best email to use is [X] because [REASON].\"",
  },

  // ─── CAMI BATCH (May 4) ──────────────────────────────────────────────

  {
    hookId: "cmorl1pen000804l1lwlr0kfm",
    note: "fatshirts to the group chat",
    ponchoPrompt:
      "my group chat is \"[GROUP CHAT NAME]\" and they've been ignoring my messages for [N] days. i'm pasting the last 200 messages. design a custom t-shirt for each person in the chat with a one-line roast specific to them based on the chat history. lowercase sans-serif text on black tees. order each shirt through purch and ship to their addresses (i'll provide). spend cap: $300. drop tracking numbers in my chat when each one ships.",
  },
  {
    hookId: "cmorl06xu000704l15ivmsjii",
    note: "how tf legal — get any CEO email",
    ponchoPrompt:
      "pull the verified work email of [EXEC NAME] at [COMPANY]. run it through hunter to confirm deliverability. also: their direct phone if public, their assistant's name + email if public, and the 3 most recent things they've said publicly — podcast, twitter, interview. format like a one-page brief i can use for outreach. spend cap: $1.",
  },
  {
    hookId: "cmorkwj5w000604l13dtid1x1",
    note: "ceo emails for job outreach",
    ponchoPrompt:
      "i'm looking for a [ROLE] at a [INDUSTRY] startup. find me 10 ceos or hiring managers at companies that are currently hiring this role OR have hired for it in the last 90 days. for each: name, verified work email through hunter, company stage and headcount, and a 4-line personalized cold email referencing something specific they've said publicly in the last 30 days. stage them — don't send yet.",
  },
  {
    hookId: "cmorkuz1p000504l16j1b6l9l",
    note: "ai slop applications won't find you a job",
    ponchoPrompt:
      "i'm in [FIELD] looking for a [ROLE]. find me 10 ceos or founders in [INDUSTRY]. pull verified emails through hunter, recent linkedin posts in the last 30 days, and any podcast or interview appearances. write a 4-line cold email for each one that references something specific they've said publicly. don't send — let me review.",
  },
  {
    hookId: "cmorktuvg000404l1mdnodigr",
    note: "instead of applying with ai resumes",
    ponchoPrompt:
      "i'm targeting a [ROLE] in [NICHE]. find me 10 hiring managers or department leads at startups in [NICHE] (50-500 employees, US-based). for each: their name, verified email, role, the company's last funding round, and one specific thing they care about based on their recent linkedin posts or podcast appearances. draft a personalized 4-sentence intro email for each one referencing my background in [YOUR BACKGROUND]. show me the list to approve before any sends.",
  },
  {
    hookId: "cmorksb99000304l1dwuygquv",
    note: "Girlies. Upload the photo.",
    ponchoPrompt:
      "i'm uploading a screenshot of a hinge profile. their name is [NAME], age [AGE], and they say they're a [ROLE] at [COMPANY]. verify the claim. cross-check linkedin, x/twitter, instagram, reddit, and any public mention of them or their work. flag inconsistencies: wrong title, wrong company, no public footprint, exes still tagged, anything suspicious. one-line verdict at the top: green / yellow / red.",
  },
  {
    hookId: "cmorkqskz000204l19824vi2n",
    note: "corolla / mercedes / porsche comparison",
    ponchoPrompt:
      "run this exact prompt through chatgpt-4o, claude opus, gemini, and poncho: \"find me 50 ceos of [INDUSTRY] startups in the US, enrich each with verified email and one personalization hook, and stage personalized cold emails for me to approve.\" capture each response. show me a side-by-side: what each one actually returned (a how-to guide? a list? a finished campaign?), how long it took, what it cost. one-screen verdict at the top.",
  },
  {
    hookId: "cmorkompz000104l1rj5r7poi",
    note: "delulumaxxing 1000 cold emails/day",
    ponchoPrompt:
      "i'm shooting my shot at [GOAL — pr packages, scholarships, vip tickets, sponsorships, brand deals]. find me 100 ideal contacts based on [CRITERIA, e.g. \"brands that have sent pr packages to creators under 50k in the last 6 months\"]. for each: verified email through hunter, role, and one personalization hook from their last 30 days of public activity. write a 4-line ask email for each one. stage them all for me to approve in one batch. show running cost.",
  },
  {
    hookId: "cmorkl4a1000004l18aszjb6o",
    note: "how tf legal — full background check",
    ponchoPrompt:
      "i'm uploading a screenshot of someone's hinge profile. give me a full public-record background on this person: name + age, employer history, any court records, eviction records, sex offender registry, news mentions in the last 5 years, and a reverse image search of the profile photo to see where else it appears online. one-page brief with a green / yellow / red verdict at the top.",
  },
  {
    hookId: "cmorkjkq0000104lask08lwni",
    note: "boss $500K uses AI for everything",
    ponchoPrompt:
      "act as a director-level operator at a [INDUSTRY] company with [HEADCOUNT] employees and [ARR] in arr. it's monday morning. give me: a one-page exec summary of the team's last 30 days based on the slack export i'll paste, the 5 biggest risks to address this week, a draft of my weekly update email to the ceo, and 3 strategic decisions i should be making by friday. format like i'm presenting at a board meeting.",
  },
];

function flagPassed(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const confirm = flagPassed("confirm");
  const dbUrl = process.env.DATABASE_URL ?? "(unset)";
  const redacted = dbUrl.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@");
  console.log(`Target DB: ${redacted}`);
  console.log(confirm ? "Mode: WRITE (--confirm passed)" : "Mode: DRY RUN");
  console.log("");

  // Preflight: look up each hook, classify into apply / skip / missing.
  const planned: { patch: Patch; existing: { onScreenText: string } }[] = [];
  const skipped: { patch: Patch; reason: string }[] = [];

  for (const patch of PATCHES) {
    const existing = await prisma.hook.findUnique({
      where: { id: patch.hookId },
      select: { onScreenText: true, ponchoPrompt: true },
    });
    if (!existing) {
      skipped.push({ patch, reason: "hook id not found in DB" });
      continue;
    }
    if (existing.ponchoPrompt) {
      skipped.push({
        patch,
        reason: "already has a ponchoPrompt (left alone)",
      });
      continue;
    }
    planned.push({ patch, existing });
  }

  console.log(`Plan: ${planned.length} to patch, ${skipped.length} to skip\n`);
  for (const p of planned) {
    console.log(`  APPLY  ${p.patch.note}`);
    console.log(`         "${p.existing.onScreenText.slice(0, 70)}..."`);
  }
  if (skipped.length > 0) {
    console.log("");
    for (const s of skipped) {
      console.log(`  SKIP   ${s.patch.note} — ${s.reason}`);
    }
  }

  if (!confirm) {
    console.log("\nDRY RUN. Re-run with --confirm to write.");
    return;
  }

  console.log("\nWriting...");
  await prisma.$transaction(async (tx) => {
    for (const { patch } of planned) {
      // updateMany with `ponchoPrompt: null` in the where clause double-checks
      // we don't overwrite something that got filled between dry-run and write.
      const result = await tx.hook.updateMany({
        where: { id: patch.hookId, ponchoPrompt: null },
        data: { ponchoPrompt: patch.ponchoPrompt },
      });
      console.log(
        `  ${result.count > 0 ? "✓" : "—"} ${patch.note} (${result.count} row${result.count === 1 ? "" : "s"})`
      );
    }
  });
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(99);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
