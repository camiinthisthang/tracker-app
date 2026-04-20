/**
 * Nuclear data reset. Wipes everything except:
 *   - Cami (camirgarzon@gmail.com) as super admin
 *   - Jacqueline (jacquelinegiale@gmail.com) as super admin
 *   - The Tapmore agency Team + its TeamSettings
 *   - TeamMember rows linking those two users to Tapmore as ADMIN
 *
 * Run with --confirm flag. Against prod:
 *   DATABASE_URL="<prod>" npx tsx scripts/reset-data.ts --confirm
 *
 * Wraps everything in a single $transaction so a partial failure rolls back.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const CAMI_EMAIL = "camirgarzon@gmail.com";
const JACQ_EMAIL = "jacquelinegiale@gmail.com";
const TAPMORE_NAME = "Tapmore";
const TAPMORE_SLUG = "tapmore";

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "Refusing to run without --confirm. Pass --confirm to actually wipe the DB.",
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? "(unset)";
  const redacted = dbUrl.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@");
  console.log(`Running reset against: ${redacted}`);

  await prisma.$transaction(
    async (tx) => {
    console.log("Preflight: collecting existing Tapmore / super-admin state…");

    const existingCami = await tx.user.findUnique({
      where: { email: CAMI_EMAIL },
      select: { id: true },
    });
    const existingJacq = await tx.user.findUnique({
      where: { email: JACQ_EMAIL },
      select: { id: true },
    });

    // Find or rename a Tapmore team. If a team with the exact name+slug exists,
    // use it. Otherwise prefer keeping Cami's current team (if she has one) and
    // renaming to Tapmore. Last resort: create fresh.
    let tapmore = await tx.team.findFirst({
      where: { OR: [{ slug: TAPMORE_SLUG }, { name: TAPMORE_NAME }] },
      select: { id: true },
    });

    if (!tapmore && existingCami) {
      const camiTeam = await tx.teamMember.findFirst({
        where: { userId: existingCami.id, role: "ADMIN" },
        select: { teamId: true },
      });
      if (camiTeam) {
        tapmore = { id: camiTeam.teamId };
        await tx.team.update({
          where: { id: tapmore.id },
          data: { name: TAPMORE_NAME, slug: TAPMORE_SLUG },
        });
        console.log(`  Renamed team ${tapmore.id} → "${TAPMORE_NAME}"`);
      }
    }

    if (!tapmore) {
      const created = await tx.team.create({
        data: { name: TAPMORE_NAME, slug: TAPMORE_SLUG },
        select: { id: true },
      });
      tapmore = created;
      console.log(`  Created fresh Tapmore team: ${tapmore.id}`);
    } else {
      // Force name/slug alignment even if team already existed.
      await tx.team.update({
        where: { id: tapmore.id },
        data: { name: TAPMORE_NAME, slug: TAPMORE_SLUG },
      });
    }

    const tapmoreId = tapmore.id;

    // Ensure Jacqueline doesn't have a blocking Creator/Application row.
    console.log("Clearing any stale Jacqueline Creator/Application rows…");
    await tx.creatorApplication.deleteMany({ where: { email: JACQ_EMAIL } });
    const jacqCreator = await tx.creator.findFirst({
      where: { email: JACQ_EMAIL },
      select: { id: true },
    });
    if (jacqCreator) {
      // Cascade handles Post, PostMetricsSnapshot, Task, CreatorMessage,
      // Upload, CreatorAttribution, ViralNotification, CampaignCreator. Null
      // out the TeamMember link first so we don't kill her User row.
      await tx.teamMember.updateMany({
        where: { creatorId: jacqCreator.id },
        data: { creatorId: null },
      });
      await tx.creator.delete({ where: { id: jacqCreator.id } });
    }

    // Upsert both super-admin users. Leave passwordHash untouched on existing
    // rows; set null for freshly-created rows so they use the /register flow.
    console.log("Upserting super admins…");
    const cami = await tx.user.upsert({
      where: { email: CAMI_EMAIL },
      update: { isSuperAdmin: true },
      create: { email: CAMI_EMAIL, name: "Cami", isSuperAdmin: true },
      select: { id: true },
    });
    const jacq = await tx.user.upsert({
      where: { email: JACQ_EMAIL },
      update: { isSuperAdmin: true },
      create: { email: JACQ_EMAIL, name: "Jacqueline", isSuperAdmin: true },
      select: { id: true },
    });

    // Wipe every child table — order matters because of FKs without cascade.
    console.log("Wiping child rows…");
    await tx.viralNotification.deleteMany({});
    await tx.creatorAttribution.deleteMany({});
    await tx.contentTraits.deleteMany({});
    await tx.postMetricsSnapshot.deleteMany({});
    await tx.campaignDailyMetric.deleteMany({});
    await tx.weeklyReportConfig.deleteMany({});
    await tx.notificationRule.deleteMany({});
    await tx.upload.deleteMany({});
    await tx.creatorMessage.deleteMany({});
    await tx.task.deleteMany({});
    await tx.post.deleteMany({});
    await tx.campaignCreator.deleteMany({});
    await tx.campaign.deleteMany({});
    await tx.bonusRule.deleteMany({});
    await tx.hook.deleteMany({});
    await tx.apiKey.deleteMany({});
    await tx.teamInvite.deleteMany({});
    await tx.creatorApplication.deleteMany({});
    await tx.creatorEarning.deleteMany({});
    await tx.verificationToken.deleteMany({});

    // Null out TeamMember.creatorId links so Creator delete works.
    await tx.teamMember.updateMany({
      where: { creatorId: { not: null } },
      data: { creatorId: null },
    });
    await tx.creator.deleteMany({});

    // Drop every TeamMember except the two we're about to re-assert.
    await tx.teamMember.deleteMany({});

    // Drop every Team other than Tapmore (cascades its TeamSettings).
    await tx.team.deleteMany({ where: { id: { not: tapmoreId } } });

    // Ensure one TeamSettings row exists for Tapmore (preserves any existing
    // schedulingUrl/creatorWelcomeTemplate/PostHog config via upsert-update
    // with empty update block).
    console.log("Ensuring Tapmore TeamSettings…");
    await tx.teamSettings.upsert({
      where: { teamId: tapmoreId },
      update: {},
      create: { teamId: tapmoreId },
    });

    // Drop every User except the two super admins. Must happen after
    // TeamMember wipe since TeamMember.userId cascades.
    console.log("Deleting non-super-admin users…");
    await tx.user.deleteMany({
      where: { id: { notIn: [cami.id, jacq.id] } },
    });

    // Recreate the two canonical TeamMember rows as ADMIN on Tapmore.
    console.log("Linking super admins to Tapmore as ADMIN…");
    await tx.teamMember.create({
      data: { userId: cami.id, teamId: tapmoreId, role: "ADMIN" },
    });
    await tx.teamMember.create({
      data: { userId: jacq.id, teamId: tapmoreId, role: "ADMIN" },
    });

    // Flag any state that slipped through — existing rows in tables we missed
    // would be a code bug, not a data issue.
    const [creatorCount, userCount, teamCount, memberCount] = await Promise.all(
      [
        tx.creator.count(),
        tx.user.count(),
        tx.team.count(),
        tx.teamMember.count(),
      ],
    );
    console.log(`  Creator.count = ${creatorCount}`);
    console.log(`  User.count    = ${userCount}`);
    console.log(`  Team.count    = ${teamCount}`);
    console.log(`  TeamMember.count = ${memberCount}`);

    if (
      creatorCount !== 0 ||
      userCount !== 2 ||
      teamCount !== 1 ||
      memberCount !== 2
    ) {
      throw new Error(
        "Post-reset counts don't match expected (0 creators, 2 users, 1 team, 2 members). Rolling back.",
      );
    }
    },
    // Prod Neon has ~100ms round-trips; default 5s transaction timeout is too
    // tight for the dozen-plus deleteManys to complete. 120s is overkill for
    // local (runs in <1s there) but necessary for prod.
    { maxWait: 10_000, timeout: 120_000 }
  );

  console.log("Reset complete.");
}

main()
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
