// Marks every existing account as email-verified.
//
// Run this ONCE, immediately before switching REQUIRE_EMAIL_VERIFICATION to
// true in lib/auth.ts. Accounts created before verification existed all have
// `emailVerified: false`, so enforcing without this locks out every current
// user — including you.
//
//   local:      node scripts/verify-existing-users.mjs
//   production: DATABASE_URL='<neon url>' node scripts/verify-existing-users.mjs
//
// Add --dry-run to see what it would change without writing.

import "dotenv/config";
import pg from "pg";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const target = url.includes("localhost") ? "LOCAL" : "REMOTE";
const client = new pg.Client({ connectionString: url });
// A late socket error with no listener is an uncaught exception.
client.on("error", () => {});
await client.connect();

const { rows: unverified } = await client.query(
  'select email, "createdAt" from "user" where "emailVerified" = false order by "createdAt"',
);

console.log(`\n  database: ${target}`);
console.log(`  unverified accounts: ${unverified.length}`);
for (const u of unverified) {
  console.log(`    ${u.email}  (created ${u.createdAt.toISOString().slice(0, 10)})`);
}

if (unverified.length === 0) {
  console.log("\n  nothing to do.\n");
  await client.end();
  process.exit(0);
}

if (dryRun) {
  console.log("\n  --dry-run: no changes written.\n");
  await client.end();
  process.exit(0);
}

const { rowCount } = await client.query(
  'update "user" set "emailVerified" = true where "emailVerified" = false',
);
console.log(`\n  marked ${rowCount} account(s) verified.`);
console.log("  safe to set REQUIRE_EMAIL_VERIFICATION = true and redeploy.\n");

await client.end();
