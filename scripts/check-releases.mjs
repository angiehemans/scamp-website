// Checkpoint for self-hosted downloads (Phase 0 of plans/paid-downloads.md).
//
//   npm run dev            # in one terminal, then:
//   node scripts/check-releases.mjs
//
// The load-bearing assertions are about what is NOT served: a staged release
// must be invisible, and an anonymous request must never reach an installer.
// Everything else is plumbing that would fail loudly anyway.
//
// Creates a fake release with tiny fake "installers", then deletes it. It never
// touches a real release: the version is stamped with the run time and the
// cleanup is scoped to that exact string.

import "dotenv/config";
import { createHash, createHmac } from "node:crypto";
import pg from "pg";
import { signUp, markVerified, cleanUp, parkReleases, BASE } from "./test-helpers.mjs";

/**
 * Writes bytes into local R2.
 *
 * Mirrors the HMAC scheme in lib/blob-store.ts, because the real upload path
 * (scripts/publish-release.mjs) goes through R2's S3 API, which needs
 * credentials that do not exist locally — miniflare emulates the binding, not
 * the S3 endpoint. Same reason the app has a `/api/blobs/direct` route at all.
 */
async function putLocalBlob(key, body) {
  const expires = Math.floor(Date.now() / 1000) + 900;
  const sig = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
    .update(`${key}:${expires}`)
    .digest("hex");
  const params = new URLSearchParams({ key, expires: String(expires), sig });
  const res = await fetch(`${BASE}/api/blobs/direct?${params}`, {
    method: "PUT",
    body,
  });
  if (!res.ok) throw new Error(`could not stage ${key}: ${res.status}`);
}

let bad = 0;
const ck = (ok, l, d = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? "  " + d : ""}`);
  if (!ok) bad++;
};

const stamp = Date.now();
const VERSION = `0.0.0-check-${stamp}`;
const email = `release-${stamp}@example.com`;

async function db(sql, params = []) {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    return await c.query(sql, params);
  } finally {
    await c.end();
  }
}

const cuid = () => "c" + Math.random().toString(36).slice(2, 16);

// ── fixture: a staged release with one fake installer per platform ───────────

const BODIES = {
  macos: Buffer.from(`fake dmg ${stamp}`),
  windows: Buffer.from(`fake exe ${stamp}`),
  linux: Buffer.from(`fake appimage ${stamp}`),
};
const FILENAMES = {
  macos: `Scamp-${VERSION}.dmg`,
  windows: `Scamp-Setup-${VERSION}.exe`,
  linux: `Scamp-${VERSION}.AppImage`,
};

// A crashed earlier run can leave a published test release behind, which then
// makes the "staged release is invisible" assertion below fail for a reason
// that has nothing to do with the code. Sentinel-prefixed versions are only
// ever created by these scripts, so clearing them first is safe.
await db(`delete from "Release" where version like '0.0.0-%'`);

// Park any other published release (e.g. a locally seeded one) so this run is
// not affected by, and does not disturb, whatever else is in the database.
const unpark = await parkReleases();

const releaseId = cuid();
await db(
  `insert into "Release" (id, version, "createdAt") values ($1, $2, now())`,
  [releaseId, VERSION],
);

const user = await signUp(email, "Release Check");
await markVerified(email);

// Put the bytes in R2 through the app's own upload path, so this works
// identically against local miniflare and a real bucket.
for (const [platform, body] of Object.entries(BODIES)) {
  const key = `releases/${VERSION}/${platform}/${FILENAMES[platform]}`;
  const sha256 = createHash("sha256").update(body).digest("hex");

  await putLocalBlob(key, body);
  await db(
    `insert into "ReleaseAsset" (id, "releaseId", platform, key, filename, "sizeBytes", sha256)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [cuid(), releaseId, platform, key, FILENAMES[platform], body.length, sha256],
  );
}

// ── staged: nothing may be served ────────────────────────────────────────────

console.log("\n  staged release:");

const stagedRes = await user.call("/api/download/macos", { redirect: "manual" });
ck(
  stagedRes.status === 404,
  "a staged release is not downloadable",
  `(${stagedRes.status})`,
);

const dashStaged = await user.call("/dashboard");
const dashStagedHtml = await dashStaged.text();
ck(
  !dashStagedHtml.includes(VERSION),
  "a staged release is not shown on the dashboard",
);

// ── published ────────────────────────────────────────────────────────────────

await db(`update "Release" set "publishedAt" = now() where id = $1`, [releaseId]);

console.log("\n  published release:");

const anon = await fetch(`${BASE}/api/download/macos`, { redirect: "manual" });
ck(
  anon.status === 401,
  "anonymous cannot download",
  `(${anon.status})`,
);

const ok = await user.call("/api/download/macos", { redirect: "manual" });
ck(ok.status === 302, "signed-in user gets a redirect", `(${ok.status})`);

const location = ok.headers.get("location") ?? "";
ck(location.length > 0, "redirect has a Location");
ck(
  !location.includes(`releases/${VERSION}`) || !location.startsWith(BASE) || location.includes("sig="),
  "the URL is signed, not a bare key",
);

// The bytes actually come back, and are the right ones.
const file = await fetch(location);
const got = Buffer.from(await file.arrayBuffer());
ck(file.status === 200, "the signed URL serves the file", `(${file.status})`);
ck(got.equals(BODIES.macos), "bytes match what was stored");

const disposition = file.headers.get("content-disposition") ?? "";
ck(
  disposition.includes(FILENAMES.macos),
  "saves under the installer's real name",
  `(${disposition || "no header"})`,
);

// Every platform resolves.
for (const platform of ["macos", "windows", "linux"]) {
  const res = await user.call(`/api/download/${platform}`, { redirect: "manual" });
  ck(res.status === 302, `${platform} resolves`, `(${res.status})`);
}

const unknown = await user.call("/api/download/solaris", { redirect: "manual" });
ck(unknown.status === 404, "an unknown platform is 404", `(${unknown.status})`);

// ── dashboard ────────────────────────────────────────────────────────────────

console.log("\n  dashboard:");

const dash = await user.call("/dashboard");
const dashHtml = await dash.text();
ck(dashHtml.includes(VERSION), "shows the published version");
ck(
  dashHtml.includes('href="/api/download/macos"'),
  "links to the download endpoint, not Gumroad",
);
ck(
  !dashHtml.includes("gumroad.com"),
  "no Gumroad link remains on the dashboard",
);

// ── a newer release wins ─────────────────────────────────────────────────────

console.log("\n  ordering:");

// Deliberately a lower version string that sorts LATER lexicographically, which
// is exactly the case a naive `order by version desc` gets wrong.
const olderId = cuid();
const OLDER = `0.0.0-check-${stamp}-old`;
await db(
  `insert into "Release" (id, version, "createdAt", "publishedAt")
   values ($1, $2, now(), now() - interval '1 day')`,
  [olderId, OLDER],
);
await db(
  `insert into "ReleaseAsset" (id, "releaseId", platform, key, filename, "sizeBytes", sha256)
   values ($1, $2, 'macos', $3, $4, 1, $5)`,
  [
    cuid(),
    olderId,
    `releases/${OLDER}/macos/old.dmg`,
    "old.dmg",
    createHash("sha256").update("old").digest("hex"),
  ],
);

const afterOlder = await user.call("/api/download/macos", { redirect: "manual" });
const afterLocation = afterOlder.headers.get("location") ?? "";
ck(
  afterLocation.includes(encodeURIComponent(FILENAMES.macos)) ||
    afterLocation.includes(FILENAMES.macos),
  "serves the newest by publishedAt, not by version string",
);

// ── cleanup ──────────────────────────────────────────────────────────────────

await db(`delete from "Release" where version in ($1, $2)`, [VERSION, OLDER]);
const removed = await cleanUp([email]);

console.log(`\n  cleaned up ${removed} account(s) and 2 test releases`);
await unpark();

console.log(bad === 0 ? "  releases: PASS" : `  ${bad} FAILURE(S)`);
process.exit(bad === 0 ? 0 : 1);
