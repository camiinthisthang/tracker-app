/**
 * Diagnose a stuck Prisma migrate lock on Postgres. The migrate lock is an
 * advisory lock keyed 72707369 (seen in Vercel build error "Timed out trying
 * to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369))").
 *
 * Run with:  DATABASE_URL=<url> npx tsx scripts/check-prisma-lock.ts
 * Add --clear to forcibly terminate any backend currently holding it.
 */
import "dotenv/config";
import { Client } from "pg";

const MIGRATE_LOCK_KEY = 72707369;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL unset");

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const { rows } = await client.query(
      `SELECT pid, usename, state, query, now() - query_start AS age
       FROM pg_stat_activity
       JOIN pg_locks USING (pid)
       WHERE locktype = 'advisory'
         AND objid = $1
         AND pid <> pg_backend_pid()`,
      [MIGRATE_LOCK_KEY],
    );

    if (rows.length === 0) {
      console.log("No stuck Prisma migrate lock. Safe to redeploy.");
      return;
    }

    console.log(`Found ${rows.length} backend(s) holding the migrate lock:`);
    for (const r of rows) {
      console.log(
        `  pid=${r.pid} user=${r.usename} state=${r.state} age=${r.age}`,
      );
      console.log(`    query: ${String(r.query ?? "").slice(0, 200)}`);
    }

    if (process.argv.includes("--clear")) {
      for (const r of rows) {
        console.log(`Terminating pid ${r.pid}…`);
        await client.query("SELECT pg_terminate_backend($1)", [r.pid]);
      }
      console.log("Cleared. Safe to redeploy now.");
    } else {
      console.log("\nPass --clear to terminate these sessions.");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
