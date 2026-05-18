/**
 * Move a creator (and their linked TeamMember row, if any) from one team to
 * another. Used to fix creators that were accidentally added to the agency
 * team — they need to live on a client team like Merit.
 *
 * Usage:
 *   npx tsx scripts/move-creator-team.ts \
 *     --creator <creatorId-or-email> \
 *     --to <targetTeamId-or-slug> \
 *     --confirm
 *
 * Against prod:
 *   DATABASE_URL="<prod>" npx tsx scripts/move-creator-team.ts \
 *     --creator alexa@... --to merit --confirm
 *
 * Without --confirm the script does a dry run, printing exactly what it would
 * change. Wraps the writes in a single $transaction.
 *
 * What changes:
 *   - Creator.teamId   -> targetTeam.id
 *   - TeamMember.teamId (the row where memberships.creatorId = creator.id)
 *     -> targetTeam.id
 * Anything else (campaign assignments, posts, uploads, tasks) is unchanged.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const creatorArg = flag("creator");
  const toArg = flag("to");
  const confirm = process.argv.includes("--confirm");

  if (!creatorArg || !toArg) {
    console.error(
      "Missing args. Usage:\n" +
        "  npx tsx scripts/move-creator-team.ts \\\n" +
        "    --creator <creatorId-or-email> --to <teamId-or-slug> [--confirm]"
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? "(unset)";
  const redacted = dbUrl.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@");
  console.log(`Target DB: ${redacted}`);
  console.log(confirm ? "Mode: WRITE (--confirm passed)" : "Mode: DRY RUN");

  // Resolve creator by id or email
  const creator = await prisma.creator.findFirst({
    where: {
      OR: [{ id: creatorArg }, { email: creatorArg }],
    },
    include: {
      team: { select: { id: true, name: true, slug: true } },
      teamMember: {
        select: {
          id: true,
          teamId: true,
          team: { select: { name: true, slug: true } },
        },
      },
    },
  });
  if (!creator) {
    console.error(`No creator found matching "${creatorArg}"`);
    process.exit(2);
  }

  // Resolve target team by id or slug
  const target = await prisma.team.findFirst({
    where: { OR: [{ id: toArg }, { slug: toArg }] },
    select: { id: true, name: true, slug: true },
  });
  if (!target) {
    console.error(`No team found matching "${toArg}"`);
    process.exit(3);
  }

  console.log(`\nCreator: ${creator.name} <${creator.email ?? "no-email"}>`);
  console.log(
    `  Creator.teamId:    ${creator.team.name} (${creator.team.slug})` +
      (creator.teamId === target.id ? " — already on target" : "")
  );
  if (creator.teamMember) {
    console.log(
      `  TeamMember.teamId: ${creator.teamMember.team.name} (${creator.teamMember.team.slug})` +
        (creator.teamMember.teamId === target.id ? " — already on target" : "")
    );
  } else {
    console.log("  TeamMember:        none (creator hasn't accepted invite yet)");
  }
  console.log(`\nTarget team:        ${target.name} (${target.slug})`);

  const creatorNeedsMove = creator.teamId !== target.id;
  const memberNeedsMove =
    creator.teamMember != null && creator.teamMember.teamId !== target.id;

  if (!creatorNeedsMove && !memberNeedsMove) {
    console.log("\nNothing to do — already on the target team.");
    return;
  }

  console.log("\nWill apply:");
  if (creatorNeedsMove) console.log("  - update Creator.teamId");
  if (memberNeedsMove) console.log("  - update TeamMember.teamId");

  if (!confirm) {
    console.log("\nDRY RUN — re-run with --confirm to actually write.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (creatorNeedsMove) {
      await tx.creator.update({
        where: { id: creator.id },
        data: { teamId: target.id },
      });
    }
    if (memberNeedsMove && creator.teamMember) {
      await tx.teamMember.update({
        where: { id: creator.teamMember.id },
        data: { teamId: target.id },
      });
    }
  });

  console.log("\nDone. Moved successfully.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(99);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
