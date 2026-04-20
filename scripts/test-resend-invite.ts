/**
 * Resend invite-email smoke test. Run with:
 *   npx tsx scripts/test-resend-invite.ts <to-email>
 *
 * Sends a real email via Resend using the same sendCreatorInvite() path the
 * app uses in production. Check the inbox after it runs.
 */
import "dotenv/config";
import { sendCreatorInvite } from "../src/lib/email/creator-invite";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npx tsx scripts/test-resend-invite.ts <to-email>");
    process.exit(1);
  }

  console.log(`FROM_EMAIL env: ${process.env.RESEND_FROM_EMAIL ?? "(unset)"}`);
  console.log(`APP_URL env:   ${process.env.NEXT_PUBLIC_APP_URL ?? "(unset)"}`);
  console.log(`Sending invite to: ${to}\n`);

  const result = await sendCreatorInvite({
    to,
    creatorName: "Test Creator",
    teamName: "Viewtrackr (smoke test)",
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invite/fake-token-for-testing`,
  });

  console.log("Result:", result);

  if (!result.ok) {
    console.error("\n❌ Email failed:", result.reason);
    process.exit(1);
  }
  console.log("\n✅ Email accepted by Resend. Check your inbox.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
