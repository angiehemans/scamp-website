// Runs Prisma commands against local or production, without pasting a
// connection string every time.
//
//   npm run db:status              local
//   npm run db:deploy              local
//   npm run db:status -- --prod    production
//   npm run db:deploy -- --prod    production
//
// Production credentials come from `.env.production.local`, which is gitignored
// by the existing `.env*` rule. Create it once:
//
//   DATABASE_URL='postgresql://…-pooler….neon.tech/db?sslmode=require'
//
// Every run prints which database it is about to touch, because the failure
// mode this replaces — pasting the wrong URL — is silent and can be
// destructive.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const isProd = args.includes("--prod");
const command = args.filter((a) => a !== "--prod");

if (command.length === 0) {
  console.error("usage: node scripts/db.mjs <prisma args…> [--prod]");
  process.exit(1);
}

/** Minimal .env parser — enough for a file holding one or two values. */
function readEnvFile(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const envFile = isProd ? ".env.production.local" : ".env";
const loaded = readEnvFile(envFile);

if (!loaded?.DATABASE_URL) {
  console.error(
    `\n  No DATABASE_URL in ${envFile}.\n` +
      (isProd
        ? "  Create it with your Neon pooled connection string:\n" +
          "    DATABASE_URL='postgresql://…-pooler….neon.tech/db?sslmode=require'\n"
        : "  Start the local database with `npx prisma dev -n scamp -d`.\n"),
  );
  process.exit(1);
}

/** Host only — never print the credentials. */
function describe(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(unparseable URL)";
  }
}

const target = isProd ? "PRODUCTION" : "local";
const banner = isProd ? "\x1b[33m" : "\x1b[2m"; // yellow for prod, dim for local

console.log(
  `${banner}  target: ${target} — ${describe(loaded.DATABASE_URL)}\x1b[0m`,
);

// Sanity check: a local run should not be pointing at a remote host, and a
// production run should not be pointing at localhost. Either means the wrong
// file was edited.
const isLocalUrl = /localhost|127\.0\.0\.1/.test(loaded.DATABASE_URL);
if (isProd && isLocalUrl) {
  console.error("  refusing: --prod was given but the URL is localhost");
  process.exit(1);
}
if (!isProd && !isLocalUrl) {
  console.error(
    "  refusing: no --prod flag, but .env points at a remote host.\n" +
      "  .env should stay on the local database — see api-docs/deployment.md",
  );
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...command], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: loaded.DATABASE_URL },
});

process.exit(result.status ?? 1);
