/**
 * Grant (or revoke) super-admin on a User by email.
 *
 * Super-admin overrides team role in getUserAccessLevel, so this gives someone
 * the full agency admin view even if they also have a CREATOR membership — their
 * Creator record is left untouched.
 *
 * Usage:
 *   DATABASE_URL=<prod> npx tsx scripts/grant-super-admin.ts --email someone@x.com
 *   DATABASE_URL=<prod> npx tsx scripts/grant-super-admin.ts --email someone@x.com --revoke
 *
 * The User must already exist (i.e. they've logged in / signed up at least
 * once). If they only have a Creator record but no login yet, have them sign in
 * once via the creator login, then re-run this.
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const emailIdx = args.indexOf("--email");
  const rawEmail = emailIdx >= 0 ? args[emailIdx + 1] : undefined;
  const revoke = args.includes("--revoke");

  if (!rawEmail) {
    console.error("Missing --email. Usage: --email someone@example.com [--revoke]");
    process.exit(1);
  }
  const email = rawEmail.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: { include: { team: { select: { name: true } } } },
    },
  });

  if (!user) {
    const creator = await prisma.creator.findFirst({
      where: { email },
      select: { id: true, name: true },
    });
    console.error(`No User account found for ${email}.`);
    if (creator) {
      console.error(
        `A Creator record exists (${creator.name}, id=${creator.id}) but they have no login yet. ` +
          `Have them sign in once via the creator login, then re-run this script.`
      );
    }
    process.exit(1);
  }

  const target = !revoke;
  if (user.isSuperAdmin === target) {
    console.log(
      `No change: ${email} already has isSuperAdmin=${target}.`
    );
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { isSuperAdmin: target },
    });
    console.log(`✓ Set isSuperAdmin=${target} for ${email} (userId=${user.id}).`);
  }

  const memberships = user.memberships
    .map((m) => `${m.team.name}:${m.role}${m.creatorId ? " (creator)" : ""}`)
    .join(", ");
  console.log(`Memberships: ${memberships || "(none)"}`);
  console.log(
    "They must sign out and back in (or refresh their session) for the new access level to take effect."
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
