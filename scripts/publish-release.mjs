// Uploads a set of installers to R2 and records them as a release.
//
//   node scripts/publish-release.mjs --version 0.6.0 --dir ~/Downloads/scamp-0.6.0
//   node scripts/publish-release.mjs --version 0.6.0 --dir ./builds --prod
//   node scripts/publish-release.mjs --version 0.6.0 --publish --prod   (go live)
//
// Files are matched to platforms by extension:
//
//   .dmg              → macos
//   .exe              → windows
//   .AppImage         → linux
//
// Populate the directory however you like. Straight from the app's GitHub
// releases works:
//
//   gh release download v0.6.0 --repo angiehemans/scamp \
//     --pattern '*.dmg' --pattern '*.exe' --pattern '*.AppImage' --dir ./builds
//
// ── Two-step on purpose ─────────────────────────────────────────────────────
// Uploading does NOT make a release live. `publishedAt` stays null until you
// run again with `--publish`, so a half-finished upload — a dropped connection
// on a 100 MB file — is never served to anyone. Verify, then publish.
//
// Uploads use S3 multipart via aws4fetch, not the R2 binding: `wrangler r2
// object put` caps at 300 MiB and does not do multipart, and a universal macOS
// build can exceed that.

import { createReadStream, readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { AwsClient } from "aws4fetch";

// ── args ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const version = flag("version");
const dir = flag("dir");
const isProd = has("prod");
const doPublish = has("publish");
const notes = flag("notes");

if (!version) {
  console.error(
    "usage: node scripts/publish-release.mjs --version <x.y.z> [--dir <path>] " +
      "[--notes <text>] [--publish] [--prod]",
  );
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`--version should look like 0.6.0, got "${version}"`);
  process.exit(1);
}
if (!dir && !doPublish) {
  console.error("nothing to do: pass --dir to upload, or --publish to go live");
  process.exit(1);
}

// ── env ──────────────────────────────────────────────────────────────────────

function readEnvFile(p) {
  const out = {};
  let text;
  try {
    text = readFileSync(p, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...readEnvFile(".env"),
  ...(isProd ? readEnvFile(".env.production.local") : {}),
  ...process.env,
};

// .env.production.local holds only DATABASE_URL; R2 credentials are the same
// bucket either way and live in .env.
const required = [
  "R2_ACCOUNT_ID",
  "R2_BUCKET_NAME",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];
const missing = required.filter((k) => !env[k]);
if (missing.length && dir) {
  console.error(
    `missing R2 credentials: ${missing.join(", ")}\n` +
      `Uploads go through the S3 API, which needs all four. See api-docs/deployment.md.`,
  );
  process.exit(1);
}

const dbUrl = isProd
  ? readEnvFile(".env.production.local").DATABASE_URL
  : env.DATABASE_URL;
if (!dbUrl) {
  console.error(
    isProd
      ? "no DATABASE_URL in .env.production.local"
      : "no DATABASE_URL in .env",
  );
  process.exit(1);
}

const target = isProd ? "PRODUCTION" : "local";
console.log(`\x1b[33m  target: ${target} — ${new URL(dbUrl).host}\x1b[0m`);
console.log(`  version: ${version}`);

// ── platform detection ───────────────────────────────────────────────────────

const BY_EXT = {
  ".dmg": "macos",
  ".exe": "windows",
  ".appimage": "linux",
};

function platformFor(filename) {
  return BY_EXT[path.extname(filename).toLowerCase()] ?? null;
}

// ── R2 multipart upload ──────────────────────────────────────────────────────

// 64 MiB. R2 requires >= 5 MiB per part except the last, and caps at 10,000
// parts; 64 MiB puts a 100 MB installer in two parts and a 5 GB one well inside
// the limit.
const PART_SIZE = 64 * 1024 * 1024;

const client = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const base = `https://${env.R2_BUCKET_NAME}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

async function r2(url, init) {
  const res = await client.fetch(url, init);
  if (!res.ok) {
    throw new Error(`R2 ${init?.method ?? "GET"} ${url} → ${res.status}\n${await res.text()}`);
  }
  return res;
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function readPart(filePath, start, end) {
  const chunks = [];
  for await (const chunk of createReadStream(filePath, { start, end: end - 1 })) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function uploadMultipart(filePath, key, size) {
  const create = await r2(`${base}/${key}?uploads=`, { method: "POST" });
  const uploadId = (await create.text()).match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!uploadId) throw new Error("R2 did not return an UploadId");

  try {
    const parts = [];
    const total = Math.ceil(size / PART_SIZE);

    for (let i = 0; i < total; i++) {
      const start = i * PART_SIZE;
      const end = Math.min(start + PART_SIZE, size);
      const body = await readPart(filePath, start, end);

      const res = await r2(`${base}/${key}?partNumber=${i + 1}&uploadId=${uploadId}`, {
        method: "PUT",
        body,
      });
      const etag = res.headers.get("etag");
      if (!etag) throw new Error(`part ${i + 1} returned no ETag`);
      parts.push({ number: i + 1, etag });

      const pct = Math.round(((i + 1) / total) * 100);
      process.stdout.write(`\r      part ${i + 1}/${total}  ${pct}%   `);
    }
    process.stdout.write("\r");

    const xml =
      "<CompleteMultipartUpload>" +
      parts
        .map((p) => `<Part><PartNumber>${p.number}</PartNumber><ETag>${p.etag}</ETag></Part>`)
        .join("") +
      "</CompleteMultipartUpload>";

    await r2(`${base}/${key}?uploadId=${uploadId}`, {
      method: "POST",
      body: xml,
      headers: { "Content-Type": "application/xml" },
    });
  } catch (error) {
    // An abandoned multipart upload keeps its parts and is billed for them, so
    // clean up rather than leaving invisible storage behind.
    await client
      .fetch(`${base}/${key}?uploadId=${uploadId}`, { method: "DELETE" })
      .catch(() => {});
    throw error;
  }
}

// ── database ─────────────────────────────────────────────────────────────────

async function db(sql, params = []) {
  const { default: pg } = await import("pg");
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

const cuid = () =>
  "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);

// ── run ──────────────────────────────────────────────────────────────────────

if (dir) {
  const entries = await readdir(dir);
  const installers = entries
    .map((name) => ({ name, platform: platformFor(name) }))
    .filter((e) => e.platform);

  if (installers.length === 0) {
    console.error(`\n  no .dmg / .exe / .AppImage files in ${dir}`);
    process.exit(1);
  }

  const seen = new Set();
  for (const { name, platform } of installers) {
    if (seen.has(platform)) {
      console.error(
        `\n  two files map to "${platform}" — ${name} is ambiguous.\n` +
          `  Keep one installer per platform in the directory.`,
      );
      process.exit(1);
    }
    seen.add(platform);
  }

  console.log(`\n  uploading ${installers.length} installer(s) from ${dir}\n`);

  await db(
    `insert into "Release" (id, version, notes, "createdAt")
     values ($1, $2, $3, now())
     on conflict (version) do update set notes = coalesce($3, "Release".notes)`,
    [cuid(), version, notes],
  );
  const releaseId = (
    await db(`select id from "Release" where version = $1`, [version])
  ).rows[0].id;

  for (const { name, platform } of installers) {
    const filePath = path.join(dir, name);
    const { size } = await stat(filePath);
    const key = `releases/${version}/${platform}/${name}`;

    console.log(`  ${platform.padEnd(8)} ${name}  (${(size / 1048576).toFixed(1)} MB)`);
    process.stdout.write("      hashing…   ");
    const sha256 = await hashFile(filePath);
    process.stdout.write(`\r      sha256 ${sha256.slice(0, 16)}…\n`);

    await uploadMultipart(filePath, key, size);

    // Read back from R2 rather than trusting the upload: a truncated part that
    // still returned 200 would otherwise be discovered by a user, mid-download.
    const head = await r2(`${base}/${key}`, { method: "HEAD" });
    const stored = Number(head.headers.get("content-length"));
    if (stored !== size) {
      console.error(
        `\n  size mismatch after upload: sent ${size}, R2 has ${stored}. Not recording.`,
      );
      process.exit(1);
    }

    await db(
      `insert into "ReleaseAsset" (id, "releaseId", platform, key, filename, "sizeBytes", sha256)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict ("releaseId", platform) do update
         set key = $4, filename = $5, "sizeBytes" = $6, sha256 = $7`,
      [cuid(), releaseId, platform, key, name, size, sha256],
    );

    console.log(`      ✓ uploaded and verified\n`);
  }
}

if (doPublish) {
  const assets = await db(
    `select platform from "ReleaseAsset" a
     join "Release" r on r.id = a."releaseId" where r.version = $1`,
    [version],
  );
  if (assets.rowCount === 0) {
    console.error(`  ${version} has no assets. Upload with --dir first.`);
    process.exit(1);
  }

  await db(
    `update "Release" set "publishedAt" = now() where version = $1 and "publishedAt" is null`,
    [version],
  );
  console.log(
    `  ✓ ${version} is live for: ${assets.rows.map((r) => r.platform).join(", ")}`,
  );
} else if (dir) {
  console.log(
    `  staged, NOT live. Verify, then:\n` +
      `    node scripts/publish-release.mjs --version ${version} --publish${isProd ? " --prod" : ""}`,
  );
}
