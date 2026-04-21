import "dotenv/config";
import { Client } from "pg";
const url = process.env.RESTORE_FROM_URL!;
const c = new Client({ connectionString: url });
(async () => {
  await c.connect();
  const { rows } = await c.query(
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog','information_schema')
     ORDER BY table_schema, table_name`,
  );
  console.table(rows);
  await c.end();
})();
