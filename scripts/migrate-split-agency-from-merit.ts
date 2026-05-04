/**
 * One-time migration. Splits the existing single team (display name "Merit",
 * slug "tapmore" — incorrectly serving as both agency and client) into two
 * teams:
 *
 *   - Merit (slug=`merit`) — the actual client. Keeps its id, all 4 creators,
 *     both campaigns, TeamSettings (PostHog config etc.), and the Merit-side
 *     staff (sam@merit.systems, ryan@merit.systems, mitch@merit.systems).
 *
 *   - Tapmore (new team, slug=`tapmore`) — the agency. Holds Cami, Jacqueline,
 *     and Regan (who is also flagged as super admin).
 *
 * Every operation is an UPDATE or INSERT. No deletes. Wrapped in a single
 * $transaction so partial failure rolls back.
 *
 * After running, the affected users (Cami, Jacqueline, Regan) must sign out
 * and sign back in for their session JWT teamId to refresh.
 *
 * Run against prod:
 *   DATABASE_URL="<prod>" npx tsx scripts/migrate-split-agency-from-merit.ts --confirm
 *
 * Without --confirm it prints the plan and exits without touching the DB.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const NEW_MERIT_SLUG = "merit";
const TAPMORE_SLUG = "tapmore";
const TAPMORE_NAME = "Tapmore";

const AGENCY_USER_EMAILS = [
  "camirgarzon@gmail.com",
  "jacquelinegiale@gmail.com",
  "regansomalley@gmail.com",
];

const NEW_SUPERADMIN_EMAILS = [
  "regansomalley@gmail.com",
];

async function main() {
  const confirm = process.argv.includes("--confirm");

  // Pre-flight: read current state, validate assumptions, print plan.
  const meritTeam = await prisma.team.findUnique({
    where: { slug: TAPMORE_SLUG },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, isSuperAdmin: true } } },
      },
      _count: { select: { creators: true, campaigns: true } },
    },
  });

  if (!meritTeam) {
    console.error(
      `No team found with slug="${TAPMORE_SLUG}". Aborting — DB is in an unexpected state.`
    );
    process.exit(1);
  }

  // Sanity: there should be exactly one team in the DB right now (the diagnostic
  // confirmed this). If a team with slug=`merit` already exists, abort — it
  // means a partial migration ran before.
  const existingMerit = await prisma.team.findUnique({
    where: { slug: NEW_MERIT_SLUG },
  });
  if (existingMerit) {
    console.error(
      `A team with slug="${NEW_MERIT_SLUG}" already exists. Migration may have partially run. Aborting.`
    );
    process.exit(1);
  }

  // Resolve the User rows we plan to move.
  const agencyUsers = await prisma.user.findMany({
    where: { email: { in: AGENCY_USER_EMAILS } },
    select: { id: true, email: true, isSuperAdmin: true },
  });

  const missing = AGENCY_USER_EMAILS.filter(
    (e) => !agencyUsers.some((u) => u.email === e)
  );
  if (missing.length > 0) {
    console.error(`Missing User rows for: ${missing.join(", ")}. Aborting.`);
    process.exit(1);
  }

  // Confirm each agency user has a TeamMember row on the current Merit team.
  const movedMemberships = meritTeam.members.filter((m) =>
    AGENCY_USER_EMAILS.includes(m.user.email)
  );
  if (movedMemberships.length !== AGENCY_USER_EMAILS.length) {
    const missingFromTeam = AGENCY_USER_EMAILS.filter(
      (e) => !movedMemberships.some((m) => m.user.email === e)
    );
    console.error(
      `These users aren't members of the Merit team: ${missingFromTeam.join(", ")}. Aborting.`
    );
    process.exit(1);
  }

  console.log("\n=== Migration plan ===\n");
  console.log(`Existing team:`);
  console.log(`  id=${meritTeam.id}`);
  console.log(`  name="${meritTeam.name}"  slug="${meritTeam.slug}"`);
  console.log(`  creators=${meritTeam._count.creators}  campaigns=${meritTeam._count.campaigns}`);
  console.log(`  members=${meritTeam.members.length}`);

  console.log(`\nUPDATE this team:`);
  console.log(`  slug:  "${meritTeam.slug}" -> "${NEW_MERIT_SLUG}"`);
  console.log(`  (name unchanged: "${meritTeam.name}")`);

  console.log(`\nINSERT new agency team:`);
  console.log(`  name="${TAPMORE_NAME}"  slug="${TAPMORE_SLUG}"  + default TeamSettings`);

  console.log(`\nMOVE TeamMember rows (UPDATE teamId) for:`);
  for (const m of movedMemberships) {
    console.log(`  - ${m.user.email}  (role=${m.role})`);
  }

  console.log(`\nFLIP isSuperAdmin=true for:`);
  for (const email of NEW_SUPERADMIN_EMAILS) {
    const u = agencyUsers.find((u) => u.email === email)!;
    console.log(`  - ${email}  (currently isSuperAdmin=${u.isSuperAdmin})`);
  }

  console.log(`\nUNCHANGED: Sam, Ryan, Mitch, all 4 creators, both campaigns,`);
  console.log(`           Merit's TeamSettings, all posts/snapshots/uploads.`);

  if (!confirm) {
    console.log(`\n[dry run] Pass --confirm to apply.`);
    return;
  }

  console.log(`\nApplying...\n`);

  await prisma.$transaction(async (tx) => {
    // 1. Rename Merit slug first, frees up "tapmore" for the new agency team.
    await tx.team.update({
      where: { id: meritTeam.id },
      data: { slug: NEW_MERIT_SLUG },
    });

    // 2. Create the new agency team.
    const tapmore = await tx.team.create({
      data: {
        name: TAPMORE_NAME,
        slug: TAPMORE_SLUG,
        settings: {
          create: {},
        },
      },
    });

    // 3. Move the agency-staff TeamMember rows. UPDATE rather than delete+create
    //    so we keep their original createdAt + role.
    for (const m of movedMemberships) {
      await tx.teamMember.update({
        where: { id: m.id },
        data: { teamId: tapmore.id },
      });
    }

    // 4. Promote Regan to super admin.
    await tx.user.updateMany({
      where: { email: { in: NEW_SUPERADMIN_EMAILS } },
      data: { isSuperAdmin: true },
    });
  });

  console.log("Done.");

  // Post-flight verification.
  const after = await prisma.team.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      members: {
        include: { user: { select: { email: true, isSuperAdmin: true } } },
      },
      _count: { select: { creators: true, campaigns: true } },
    },
  });

  console.log("\n=== Post-migration state ===\n");
  for (const t of after) {
    console.log(`[${t.slug}] "${t.name}"  id=${t.id}`);
    console.log(`  creators=${t._count.creators}  campaigns=${t._count.campaigns}`);
    for (const m of t.members) {
      const tag = m.user.isSuperAdmin ? " [SUPERADMIN]" : "";
      console.log(`    - ${m.user.email}  role=${m.role}${tag}`);
    }
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
