/**
 * Set CampaignCreator.monthlyPostGoal for a fixed list of creators.
 *
 * Matches by case-insensitive `LIKE 'firstname%'` on Creator.name. For each
 * matched creator, sets the goal on EVERY CampaignCreator row they have
 * (across all campaigns). If a creator has rows on multiple campaigns and
 * the goal should differ per campaign, edit them in the campaign form
 * instead — this script is the bulk shortcut for the case where one number
 * applies everywhere.
 *
 * Re-running is safe: idempotent (always sets to the same number) and
 * skips creators whose row already has that exact goal.
 *
 * Usage:
 *   DATABASE_URL="<prod>" npx tsx scripts/set-monthly-goals.ts          # dry run
 *   DATABASE_URL="<prod>" npx tsx scripts/set-monthly-goals.ts --confirm
 */
import { prisma } from "../src/lib/prisma";

// First-name keyword → monthly post goal.
const GOALS: Record<string, number> = {
  claire: 40,
  yani: 40,
  sophia: 40,
  brittany: 40,
  alexa: 60,
  mark: 40,
  amber: 40,
  samantha: 40,
  kevin: 60,
};

async function main() {
  const confirm = process.argv.includes("--confirm");

  console.log(
    confirm
      ? "Applying monthly goals to CampaignCreator rows…"
      : "DRY RUN — no writes. Pass --confirm to apply.\n"
  );

  let touched = 0;
  let unchanged = 0;
  const notFound: string[] = [];

  for (const [keyword, goal] of Object.entries(GOALS)) {
    const creators = await prisma.creator.findMany({
      where: { name: { startsWith: keyword, mode: "insensitive" } },
      include: { campaignCreators: { include: { campaign: { select: { name: true } } } } },
    });

    if (creators.length === 0) {
      notFound.push(keyword);
      continue;
    }

    for (const creator of creators) {
      if (creator.campaignCreators.length === 0) {
        console.log(`  ${creator.name}: no CampaignCreator rows — skipping`);
        continue;
      }
      for (const cc of creator.campaignCreators) {
        if (cc.monthlyPostGoal === goal) {
          unchanged++;
          continue;
        }
        console.log(
          `  ${creator.name} · ${cc.campaign.name}: ${cc.monthlyPostGoal ?? "—"} → ${goal}`
        );
        if (confirm) {
          await prisma.campaignCreator.update({
            where: { id: cc.id },
            data: { monthlyPostGoal: goal },
          });
        }
        touched++;
      }
    }
  }

  console.log("");
  console.log(`Touched: ${touched}`);
  console.log(`Already at target: ${unchanged}`);
  if (notFound.length > 0) {
    console.log(`No creator matched: ${notFound.join(", ")}`);
  }
  if (!confirm) {
    console.log("\n(dry run — pass --confirm to apply)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
