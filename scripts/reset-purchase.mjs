// Clears an account's pay-what-you-want answer so the prompt appears again.
// Development only.
//
//   node scripts/reset-purchase.mjs you@example.com
//
// The form is deliberately shown once per account (see lib/purchases.ts), which
// makes it awkward to look at twice while working on it. This deletes the
// Purchase rows for one account so the next visit asks again.

import "dotenv/config";
import pg from "pg";

const email = process.argv[2];
if (!email) {
  console.error("usage: node scripts/reset-purchase.mjs <email>");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(dbUrl)) {
  console.error(
    "\n  refusing to run: DATABASE_URL is not local.\n" +
      "  Deleting purchase records in production would destroy revenue history.\n",
  );
  process.exit(1);
}

const c = new pg.Client({ connectionString: dbUrl });
// A late socket error with no listener is an uncaught exception.
c.on("error", () => {});
await c.connect();
const { rows } = await c.query(`select id from "user" where email = $1`, [
  email,
]);
if (rows.length === 0) {
  console.error(`  no account for ${email}`);
  await c.end();
  process.exit(1);
}
const { rowCount } = await c.query(
  `delete from "Purchase" where "userId" = $1`,
  [rows[0].id],
);
await c.end();

console.log(`  cleared ${rowCount} purchase record(s) for ${email}`);
console.log("  the pay-what-you-want prompt will show again on /dashboard");
