// Phase 3 checkpoint for plans/cloud-backup.md.
//
// Pushes this repository through the real protocol using scripts/fake-client.mjs,
// which is also the reference implementation for the Electron client.
//
// The headline assertion is the ignore layer: this repo must push a few hundred
// files, not the ~68,000 in node_modules. The second is deduplication: pushing
// the same tree again must transfer zero blobs.
//
// Requires `npm run dev`. Run: node scripts/check-push.mjs

import { push, walk, buildManifest, api, ORIGIN, BASE } from "./fake-client.mjs";
import { execSync } from "node:child_process";
import { markVerified, enableCloud, closeDb } from "./test-helpers.mjs";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};
const fmt = (n) => n.toLocaleString("en-US");

const stamp = Date.now();
const email = `push-${stamp}@example.com`;
const password = "correct-horse-battery";

const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", origin: ORIGIN },
  body: JSON.stringify({ name: "Push Check", email, password }),
});
if (!signup.ok) throw new Error(`sign-up failed: ${signup.status}`);
// Cloud backup requires a verified address and the cloud entitlement, so
// stand in for the user clicking the emailed link and for the admin switch.
await markVerified(email);
await enableCloud(email);
const cookie = (signup.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const call = api(cookie);
process.env.SCAMP_COOKIE = cookie;

const created = await call("/api/projects", {
  method: "POST",
  body: JSON.stringify({ name: "checkpoint" }),
});
const { project } = await created.json();

// ── the headline: ignore rules ───────────────────────────────────────────────
console.log("\n  ignore layer:");

const nodeModulesCount = Number(
  execSync("find node_modules -type f 2>/dev/null | wc -l").toString().trim(),
);
const { files } = walk(".");
// Files and blobs are not the same number: identical content is one blob no
// matter how many paths point at it. That is dedup working *within* a single
// push, before any version history is involved.
const { manifest } = buildManifest(".", files);
const uniqueHashes = new Set(Object.values(manifest)).size;
check(
  files.length < 2000,
  `pushes ${fmt(files.length)} files, not the ${fmt(nodeModulesCount)} in node_modules`,
);
check(
  !files.some((f) => f.startsWith("node_modules/")),
  "no node_modules paths in the manifest",
);
check(!files.some((f) => f.startsWith(".git/")), "no .git paths in the manifest");
check(!files.some((f) => f === ".env"), "no .env in the manifest (gitignored)");

// ── first push ───────────────────────────────────────────────────────────────
console.log("\n  first push:");
const first = await push(".", project.id);
check(
  first.uploaded === uniqueHashes,
  "uploaded one blob per unique content",
  `(${fmt(first.uploaded)} blobs for ${fmt(files.length)} files)`,
);
check(
  uniqueHashes < files.length,
  "identical files collapsed to one blob",
  `(${fmt(files.length - uniqueHashes)} duplicate path(s) deduped)`,
);
check(first.fileCount === files.length, "version records every file", `(${fmt(first.fileCount)})`);
check(first.totalBytes > 0, "version records a byte total", `(${fmt(first.totalBytes)} bytes)`);

// ── second push: the dedup claim ─────────────────────────────────────────────
console.log("\n  second push of the same tree:");
const second = await push(".", project.id);
check(second.uploaded === 0, "transferred ZERO blobs", `(${second.uploaded})`);
check(second.versionId !== first.versionId, "still recorded a new version");
check(second.fileCount === first.fileCount, "same file count");

// ── storage accounting ───────────────────────────────────────────────────────
console.log("\n  accounting:");
const detail = await (await call(`/api/projects/${project.id}`)).json();
check(detail.project.versionCount === 2, "two versions recorded", `(${detail.project.versionCount})`);
// The real claim: two versions of the same tree do not double storage. Stored
// bytes are also *below* a single version's byte total, because duplicate paths
// share one blob.
check(
  detail.project.storedBytes < first.totalBytes,
  "stored bytes below per-version total (duplicates share a blob)",
  `(${fmt(detail.project.storedBytes)} stored vs ${fmt(first.totalBytes)} per version)`,
);
check(
  detail.project.storedBytes * 2 < first.totalBytes + second.totalBytes,
  "two versions did not double storage",
);

// ── rejections ───────────────────────────────────────────────────────────────
console.log("\n  rejections:");

const traversal = await call(`/api/projects/${project.id}/push/prepare`, {
  method: "POST",
  body: JSON.stringify({ manifest: { "../../etc/passwd": "a".repeat(64) } }),
});
check(traversal.status === 400, "path traversal rejected", `(${traversal.status})`);

const absolute = await call(`/api/projects/${project.id}/push/prepare`, {
  method: "POST",
  body: JSON.stringify({ manifest: { "/etc/passwd": "a".repeat(64) } }),
});
check(absolute.status === 400, "absolute path rejected", `(${absolute.status})`);

const badHash = await call(`/api/projects/${project.id}/push/prepare`, {
  method: "POST",
  body: JSON.stringify({ manifest: { "a.tsx": "not-a-hash" } }),
});
check(badHash.status === 400, "malformed hash rejected", `(${badHash.status})`);

const tooMany = await call(`/api/projects/${project.id}/push/prepare`, {
  method: "POST",
  body: JSON.stringify({
    manifest: Object.fromEntries(
      Array.from({ length: 20_001 }, (_, i) => [`f${i}.txt`, "b".repeat(64)]),
    ),
  }),
});
check(tooMany.status === 400, "over-large manifest rejected", `(${tooMany.status})`);

// Committing content that was never uploaded must fail loudly, not silently
// produce a version that cannot be restored.
const phantom = await call(`/api/projects/${project.id}/push/commit`, {
  method: "POST",
  body: JSON.stringify({ manifest: { "ghost.tsx": "c".repeat(64) } }),
});
check(phantom.status === 409, "commit of never-uploaded content rejected", `(${phantom.status})`);

// ── isolation ────────────────────────────────────────────────────────────────
console.log("\n  isolation:");
const otherEmail = `other-${stamp}@example.com`;
const otherSignup = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", origin: ORIGIN },
  body: JSON.stringify({ name: "Other", email: otherEmail, password }),
});
// Verified too: otherwise the sync gate returns 403 before ownership is even
// checked, and the 404 assertion below would pass for the wrong reason.
await markVerified(otherEmail);
await enableCloud(otherEmail);
const otherCookie = (otherSignup.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const otherCall = api(otherCookie);
const intruder = await otherCall(`/api/projects/${project.id}/push/prepare`, {
  method: "POST",
  body: JSON.stringify({ manifest: { "a.tsx": "d".repeat(64) } }),
});
check(intruder.status === 404, "another user cannot push to this project", `(${intruder.status})`);

// ── cleanup ──────────────────────────────────────────────────────────────────
const del = await call(`/api/projects/${project.id}`, { method: "DELETE" });
const delBody = await del.json();
console.log(`\n  cleanup: deleted project, ${fmt(delBody.blobsDeleted)} blobs removed from R2`);
check(
  delBody.blobsDeleted === uniqueHashes,
  "project delete removed every blob",
  `(${fmt(delBody.blobsDeleted)} of ${fmt(uniqueHashes)})`,
);

console.log(failures === 0 ? "\nPhase 3 checkpoint: PASS" : `\nPhase 3 checkpoint: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
