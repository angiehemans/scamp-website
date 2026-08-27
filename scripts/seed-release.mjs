// Puts a release into the LOCAL database so the download flow can be clicked
// through. Development only — it refuses to touch production.
//
//   node scripts/seed-release.mjs                      # placeholder installers
//   node scripts/seed-release.mjs --version 0.6.0      # name it
//   node scripts/seed-release.mjs --dir ./builds       # use real installers
//   node scripts/seed-release.mjs --clear              # remove seeded releases
//
// ── Why this is not publish-release.mjs ──────────────────────────────────────
// The real publish path uploads through R2's S3 API, which needs credentials
// that do not exist locally: miniflare emulates the R2 *binding*, not the S3
// HTTP endpoint. So this writes bytes through the app's own `/api/blobs/direct`
// route instead, exactly as the checkpoint scripts do.
//
// With no `--dir`, the "installers" are a few bytes of text. That is enough to
// exercise everything except the size: the button, the pay-what-you-want form,
// the claim, the redirect, and the file actually arriving with the right name.
// Pass `--dir` with real files to check a 100 MB download end to end.

import "dotenv/config";
import { createHash, createHmac } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? null : argv[i + 1];
};
const has = (n) => argv.includes(`--${n}`);

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const VERSION = flag("version") ?? "0.6.0-dev";
const dir = flag("dir");

// Refuse to run anywhere that looks like production. This script fabricates
// releases; doing that to the live database would put a fake build in front of
// real users.
const dbUrl = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(dbUrl)) {
  console.error(
    `\n  refusing to run: DATABASE_URL is not local.\n` +
      `  ${dbUrl.replace(/:[^:@]+@/, ":****@")}\n\n` +
      `  Use scripts/publish-release.mjs for anything real.\n`,
  );
  process.exit(1);
}

async function db(sql, params = []) {
  const c = new pg.Client({ connectionString: dbUrl });
  // A late socket error with no listener is an uncaught exception.
  c.on("error", () => {});
  await c.connect();
  try {
    return await c.query(sql, params);
  } finally {
    await c.end();
  }
}

const cuid = () => "c" + Math.random().toString(36).slice(2, 16);

if (has("clear")) {
  const { rowCount } = await db(
    `delete from "Release" where version like '%-dev' or version like '0.0.0-%'`,
  );
  console.log(`  removed ${rowCount} seeded release(s)`);
  process.exit(0);
}

async function putLocalBlob(key, body) {
  const expires = Math.floor(Date.now() / 1000) + 900;
  const sig = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
    .update(`${key}:${expires}`)
    .digest("hex");
  const p = new URLSearchParams({ key, expires: String(expires), sig });
  const res = await fetch(`${BASE}/api/blobs/direct?${p}`, {
    method: "PUT",
    body,
  });
  if (!res.ok) {
    throw new Error(
      `could not write ${key}: ${res.status}. Is \`npm run dev\` running?`,
    );
  }
}

const BY_EXT = { ".dmg": "macos", ".exe": "windows", ".appimage": "linux" };

/** Either real installers from --dir, or small placeholders. */
async function collect() {
  if (!dir) {
    return [
      { platform: "macos", filename: `Scamp-${VERSION}.dmg` },
      { platform: "windows", filename: `Scamp-Setup-${VERSION}.exe` },
      { platform: "linux", filename: `Scamp-${VERSION}.AppImage` },
    ].map((f) => ({
      ...f,
      body: Buffer.from(
        `This is a placeholder installer for ${f.platform}, seeded by ` +
          `scripts/seed-release.mjs. Not a real build.\n`,
      ),
    }));
  }

  const out = [];
  for (const name of await readdir(dir)) {
    const platform = BY_EXT[path.extname(name).toLowerCase()];
    if (!platform) continue;
    out.push({
      platform,
      filename: name,
      body: await readFile(path.join(dir, name)),
    });
  }
  if (out.length === 0) {
    console.error(`  no .dmg / .exe / .AppImage files in ${dir}`);
    process.exit(1);
  }
  return out;
}

const files = await collect();

await db(`delete from "Release" where version = $1`, [VERSION]);
const releaseId = cuid();
await db(
  `insert into "Release" (id, version, "createdAt", "publishedAt")
   values ($1, $2, now(), now())`,
  [releaseId, VERSION],
);

console.log(`\n  seeding ${VERSION} into the local database\n`);

for (const { platform, filename, body } of files) {
  const key = `releases/${VERSION}/${platform}/${filename}`;
  await putLocalBlob(key, body);
  await db(
    `insert into "ReleaseAsset" (id, "releaseId", platform, key, filename, "sizeBytes", sha256)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      cuid(),
      releaseId,
      platform,
      key,
      filename,
      body.length,
      createHash("sha256").update(body).digest("hex"),
    ],
  );
  const size =
    body.length > 1048576
      ? `${(body.length / 1048576).toFixed(1)} MB`
      : `${body.length} B`;
  console.log(`  ✓ ${platform.padEnd(8)} ${filename}  (${size})`);
}

console.log(
  `\n  published. Open ${BASE}/dashboard — you should see three platform` +
    `\n  buttons and the pay-what-you-want prompt.\n` +
    `\n  Already answered the prompt on this account and want it back?` +
    `\n    node scripts/reset-purchase.mjs <your@email>\n`,
);
