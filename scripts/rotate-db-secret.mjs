// Pushes the DATABASE_URL from .env.production.local to the Cloudflare Worker.
//
//   node scripts/rotate-db-secret.mjs --check   # test the URL, change nothing
//   node scripts/rotate-db-secret.mjs           # test it, then push it
//
// ── Why this exists ─────────────────────────────────────────────────────────
// Neon invalidates the old password the moment you reset it, so production
// cannot reach the database until the Worker secret is updated. Doing that by
// hand means finding the command, pasting a long string, and hoping it is
// right — with the site down the whole time.
//
// This makes the window a single command, and refuses to push a URL that does
// not actually work. Pushing a typo would turn a 30-second outage into one
// that lasts until someone notices.
//
// The password is never printed.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import pg from "pg";

const checkOnly = process.argv.includes("--check");

function readEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) {
      out[t.slice(0, i).trim()] = t
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const url = readEnv(".env.production.local").DATABASE_URL;
if (!url) {
  console.error("\n  no DATABASE_URL in .env.production.local\n");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error("\n  DATABASE_URL is not a valid URL\n");
  process.exit(1);
}

console.log(`\n  host:     ${parsed.hostname}`);
console.log(`  user:     ${parsed.username}`);
console.log(`  password: ${parsed.password.length} characters`);

if (!parsed.hostname.includes("neon.tech")) {
  console.error("\n  refusing: that is not a Neon host.\n");
  process.exit(1);
}
if (!parsed.hostname.includes("-pooler")) {
  console.error(
    "\n  refusing: that is the DIRECT connection string, not the pooled one.\n" +
      "  Workers need the pooled endpoint — the one with `-pooler` in the host.\n",
  );
  process.exit(1);
}
if (!parsed.password) {
  console.error("\n  refusing: no password in the connection string.\n");
  process.exit(1);
}

// Prove it works before pushing it. A URL that does not connect would take
// production down until someone worked out why.
process.stdout.write("\n  testing the connection… ");
const client = new pg.Client({ connectionString: url });
client.on("error", () => {});
try {
  await client.connect();
  const { rows } = await client.query(
    'select count(*)::int as n from "user"',
  );
  await client.end();
  console.log(`works (${rows[0].n} accounts)`);
} catch (error) {
  console.log("FAILED");
  console.error(`\n  ${error.message}\n\n  Nothing was changed.\n`);
  process.exit(1);
}

if (checkOnly) {
  console.log("\n  --check: the Worker secret was NOT touched.\n");
  process.exit(0);
}

process.stdout.write("  pushing to the Worker secret… ");
const res = spawnSync("npx", ["wrangler", "secret", "put", "DATABASE_URL"], {
  input: url,
  encoding: "utf8",
});

if (res.status !== 0) {
  console.log("FAILED");
  console.error(res.stderr || res.stdout);
  process.exit(1);
}
console.log("done");

console.log(
  "\n  Updating a secret publishes a new Worker version, so this is live\n" +
    "  already. Verify with a page that reads the database:\n\n" +
    "    curl -s -o /dev/null -w '%{http_code}\\n' https://www.scamp.club/sign-in\n",
);
