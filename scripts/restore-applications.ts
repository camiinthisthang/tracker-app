/**
 * Copy every CreatorApplication row from a Neon point-in-time branch back
 * into main. Used to recover the applications accidentally wiped by
 * scripts/reset-data.ts (task 1 spec listed CreatorApplication in the wipe;
 * we should have scoped it narrower).
 *
 * Run with:
 *   RESTORE_FROM_URL="<read-only branch uri>" \
 *   DATABASE_URL="<main prod uri>" \
 *   npx tsx scripts/restore-applications.ts --confirm
 *
 * Uses plain pg client (not Prisma) so it works even if the main branch has
 * schema newer than the restore branch. Idempotent: `ON CONFLICT (id) DO
 * NOTHING` — running it twice just no-ops on the second pass.
 */
import "dotenv/config";
import { Client } from "pg";

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Pass --confirm to actually run the restore.");
    process.exit(1);
  }

  const srcUrl = process.env.RESTORE_FROM_URL;
  const dstUrl = process.env.DATABASE_URL;
  if (!srcUrl || !dstUrl) {
    throw new Error("RESTORE_FROM_URL and DATABASE_URL both required");
  }

  const src = new Client({ connectionString: srcUrl });
  const dst = new Client({ connectionString: dstUrl });
  await src.connect();
  await dst.connect();

  try {
    const { rows: srcRows } = await src.query(
      `SELECT id, name, email, phone, location,
              "instagramHandle", "tiktokHandle",
              about, "videoUrls", "canCommit", status, "reviewNotes",
              "createdAt", "updatedAt"
       FROM creator_applications
       ORDER BY "createdAt" ASC`,
    );
    console.log(`Restore branch has ${srcRows.length} applications.`);

    const { rows: existingRows } = await dst.query(
      `SELECT count(*)::int AS c FROM creator_applications`,
    );
    console.log(`Main currently has ${existingRows[0].c} applications.`);

    if (srcRows.length === 0) {
      console.log("Nothing to restore. Exiting.");
      return;
    }

    let inserted = 0;
    let skipped = 0;

    await dst.query("BEGIN");
    try {
      for (const r of srcRows) {
        const res = await dst.query(
          `INSERT INTO creator_applications
             (id, name, email, phone, location,
              "instagramHandle", "tiktokHandle",
              about, "videoUrls", "canCommit", status, "reviewNotes",
              "createdAt", "updatedAt")
           VALUES
             ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (id) DO NOTHING`,
          [
            r.id,
            r.name,
            r.email,
            r.phone,
            r.location,
            r.instagramHandle,
            r.tiktokHandle,
            r.about,
            r.videoUrls,
            r.canCommit,
            r.status,
            r.reviewNotes,
            r.createdAt,
            r.updatedAt,
          ],
        );
        if (res.rowCount === 1) inserted += 1;
        else skipped += 1;
      }
      await dst.query("COMMIT");
    } catch (err) {
      await dst.query("ROLLBACK");
      throw err;
    }

    const { rows: finalRows } = await dst.query(
      `SELECT count(*)::int AS c FROM creator_applications`,
    );
    console.log(`\nInserted: ${inserted}`);
    console.log(`Skipped (already existed): ${skipped}`);
    console.log(`Main now has: ${finalRows[0].c} applications.`);
  } finally {
    await src.end();
    await dst.end();
  }
}

main().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
