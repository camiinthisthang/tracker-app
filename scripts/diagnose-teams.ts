/**
 * Read-only diagnostic. Prints every Team in the DB with its members + open
 * invites, then prints any Users / TeamMembers / Creators whose email or
 * handle contains the search term (default: "poncho").
 *
 * Run against prod:
 *   DATABASE_URL="<prod>" npx tsx scripts/diagnose-teams.ts
 *   DATABASE_URL="<prod>" npx tsx scripts/diagnose-teams.ts <search-term>
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const search = process.argv[2]?.toLowerCase() ?? "poncho";

  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      members: {
        include: { user: { select: { email: true, isSuperAdmin: true } } },
      },
      invites: { where: { acceptedAt: null } },
      _count: { select: { creators: true, campaigns: true } },
    },
  });

  console.log(`\n=== Teams (${teams.length}) ===`);
  for (const t of teams) {
    console.log(`\n[${t.slug}] "${t.name}"  id=${t.id}`);
    console.log(
      `  creators=${t._count.creators}  campaigns=${t._count.campaigns}`
    );
    console.log(`  members (${t.members.length}):`);
    for (const m of t.members) {
      const tag = m.user.isSuperAdmin ? " [SUPERADMIN]" : "";
      console.log(`    - ${m.user.email}  role=${m.role}${tag}`);
    }
    if (t.invites.length > 0) {
      console.log(`  open invites (${t.invites.length}):`);
      for (const i of t.invites) {
        console.log(`    - ${i.email}  role=${i.role}  expires=${i.expiresAt.toISOString()}`);
      }
    }
  }

  console.log(`\n=== Users matching "${search}" ===`);
  const users = await prisma.user.findMany({
    where: { email: { contains: search, mode: "insensitive" } },
    include: {
      memberships: { include: { team: { select: { name: true, slug: true } } } },
    },
  });
  for (const u of users) {
    console.log(`- ${u.email}  superAdmin=${u.isSuperAdmin}  passwordSet=${!!u.passwordHash}`);
    for (const tm of u.memberships) {
      console.log(`    member of [${tm.team.slug}] "${tm.team.name}"  role=${tm.role}`);
    }
  }
  if (users.length === 0) console.log("  (none)");

  console.log(`\n=== Creators matching "${search}" ===`);
  const creators = await prisma.creator.findMany({
    where: {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { handle: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { tiktokHandle: { contains: search, mode: "insensitive" } },
        { instagramHandle: { contains: search, mode: "insensitive" } },
      ],
    },
    include: { team: { select: { name: true, slug: true } } },
  });
  for (const c of creators) {
    console.log(
      `- ${c.name} (@${c.handle})  email=${c.email ?? "—"}  team=[${c.team.slug}] "${c.team.name}"`
    );
  }
  if (creators.length === 0) console.log("  (none)");

  console.log(`\n=== Open team invites matching "${search}" ===`);
  const invites = await prisma.teamInvite.findMany({
    where: {
      acceptedAt: null,
      email: { contains: search, mode: "insensitive" },
    },
    include: { team: { select: { name: true, slug: true } } },
  });
  for (const i of invites) {
    console.log(
      `- ${i.email}  role=${i.role}  team=[${i.team.slug}] "${i.team.name}"  expires=${i.expiresAt.toISOString()}`
    );
  }
  if (invites.length === 0) console.log("  (none)");

  console.log("\nDone.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
