/**
 * Set (or reset) the email/password login for a User by email.
 *
 * Passwords are stored as bcrypt hashes and can never be recovered — this is
 * the recovery path until a self-serve "forgot password" flow exists. Prints
 * nothing sensitive; the new password is whatever you passed in.
 *
 * Usage:
 *   DATABASE_URL=<prod> npx tsx scripts/set-password.ts --email someone@x.com --password 'NewPassw0rd!'
 *
 * The User must already exist (signed up, accepted an invite, or signed in
 * with Google at least once). Google sign-in keeps working alongside the new
 * password.
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function main() {
  const args = process.argv.slice(2);
  const emailIdx = args.indexOf("--email");
  const passwordIdx = args.indexOf("--password");
  const rawEmail = emailIdx >= 0 ? args[emailIdx + 1] : undefined;
  const password = passwordIdx >= 0 ? args[passwordIdx + 1] : undefined;

  if (!rawEmail || !password) {
    console.error(
      "Usage: --email someone@example.com --password 'NewPassw0rd!'"
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const email = rawEmail.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(
      `No User account found for ${email}. Send them a team invite first ` +
        `(Team page → Invite manager) or have them sign in once with Google.`
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(
    `✓ Password ${user.passwordHash ? "reset" : "set"} for ${email} (userId=${user.id}).`
  );
  console.log("They can now sign in with email + password at /login.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
