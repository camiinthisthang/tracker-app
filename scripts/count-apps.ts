import "dotenv/config";
import { Client } from "pg";
const url = process.env.RESTORE_FROM_URL!;
const c = new Client({ connectionString: url });
(async () => {
  await c.connect();
  const { rows } = await c.query(
    `SELECT count(*)::int AS total, min("createdAt") AS earliest, max("createdAt") AS latest FROM creator_applications`
  );
  console.log(rows[0]);
  const sample = await c.query(
    `SELECT id, email, name, status, "createdAt" FROM creator_applications ORDER BY "createdAt" DESC LIMIT 10`
  );
  console.table(sample.rows);
  await c.end();
})();
