// Phase 4 checkpoint for plans/cloud-backup.md.
//
// Proves restore is byte-exact. Three ways:
//   1. a fixture of awkward files -> push -> pull -> `diff -r` clean
//   2. this whole repository      -> push -> pull -> `diff -r` clean
//   3. restoring an OLD version returns the old content, not the newest
//
// (3) is the actual product promise — "back up to a past version stored on the
// cloud" — so it gets tested, not assumed.
//
// Requires `npm run dev`. Run: node scripts/check-pull.mjs

import { push, pull, walk, api, ORIGIN, BASE } from "./fake-client.mjs";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};
const fmt = (n) => n.toLocaleString("en-US");

/** `diff -r` between two trees. Returns null when identical. */
function diffTrees(a, b) {
  try {
    execFileSync("diff", ["-r", a, b], { stdio: "pipe" });
    return null;
  } catch (e) {
    return (e.stdout?.toString() || e.stderr?.toString() || "differs").trim();
  }
}

const tmp = mkdtempSync(join(tmpdir(), "scamp-pull-"));
const write = (root, rel, content) => {
  const dest = join(root, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
};

// ── account + project ────────────────────────────────────────────────────────
const stamp = Date.now();
const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", origin: ORIGIN },
  body: JSON.stringify({
    name: "Pull Check",
    email: `pull-${stamp}@example.com`,
    password: "correct-horse-battery",
  }),
});
if (!signup.ok) throw new Error(`sign-up failed: ${signup.status}`);
const cookie = (signup.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
process.env.SCAMP_COOKIE = cookie;
const call = api(cookie);

const mkProject = async (name) =>
  (await (await call("/api/projects", { method: "POST", body: JSON.stringify({ name }) })).json())
    .project;

// ── 1. fixture with awkward content ──────────────────────────────────────────
console.log("\n  fixture round trip:");

const src = join(tmp, "fixture-src");
const dst = join(tmp, "fixture-dst");
mkdirSync(src, { recursive: true });
mkdirSync(dst, { recursive: true });

write(src, "home.tsx", 'export default function Home() {\n  return <div>hi</div>;\n}\n');
write(src, "home.module.css", ".root { color: red; }\n");
write(src, "theme.css", ":root { --brand: #f00; }\n");
write(src, "nested/deep/page.tsx", "export default () => null;\n");
write(src, "unicode-—ünïcode.txt", Buffer.from("héllo — ✓ 🎨\n", "utf8"));
write(src, "empty.txt", Buffer.alloc(0));
write(src, "assets/photo.jpg", randomBytes(3 * 1024 * 1024)); // large binary
write(src, "assets/icon.png", Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), randomBytes(8192)]));
write(src, "assets/copy-of-icon.png", Buffer.alloc(0)); // replaced below to force a dupe
const iconBytes = readFileSync(join(src, "assets/icon.png"));
write(src, "assets/copy-of-icon.png", iconBytes); // identical content, second path
write(src, "crlf.txt", Buffer.from("line1\r\nline2\r\n", "binary"));
write(src, ".gitignore", "ignored-dir/\n*.log\n");
write(src, "ignored-dir/secret.txt", "should not sync\n");
write(src, "debug.log", "should not sync\n");

const fixtureProject = await mkProject("fixture");
const fixturePush = await push(src, fixtureProject.id);
const fixturePull = await pull(dst, fixtureProject.id);

check(
  fixturePull.fileCount === fixturePush.fileCount,
  "restored the same file count",
  `(${fixturePull.fileCount})`,
);

// The ignored files exist in src but must not be in dst, so compare dst against
// a copy of src with them removed.
const srcExpected = join(tmp, "fixture-src-expected");
cpSync(src, srcExpected, { recursive: true });
rmSync(join(srcExpected, "ignored-dir"), { recursive: true, force: true });
rmSync(join(srcExpected, "debug.log"), { force: true });

const fixtureDiff = diffTrees(srcExpected, dst);
check(fixtureDiff === null, "diff -r clean (3 MB binary, unicode, empty, CRLF)", fixtureDiff ?? "");

// ── 2. restoring an old version ──────────────────────────────────────────────
console.log("\n  restoring a past version:");

write(src, "home.tsx", "export default function Home() {\n  return <div>CHANGED</div>;\n}\n");
write(src, "assets/photo.jpg", randomBytes(1024 * 512)); // different image entirely
const v2 = await push(src, fixtureProject.id);
check(v2.versionId !== fixturePush.versionId, "second version recorded");

const oldDir = join(tmp, "fixture-v1");
mkdirSync(oldDir, { recursive: true });
await pull(oldDir, fixtureProject.id, fixturePush.versionId);

const restoredHome = readFileSync(join(oldDir, "home.tsx"), "utf8");
check(restoredHome.includes("<div>hi</div>"), "old version returns the ORIGINAL text");
check(!restoredHome.includes("CHANGED"), "old version is not the newest content");
check(
  Buffer.compare(readFileSync(join(oldDir, "assets/photo.jpg")), readFileSync(join(srcExpected, "assets/photo.jpg"))) === 0,
  "old version returns the ORIGINAL 3 MB binary byte-for-byte",
);

const latestDir = join(tmp, "fixture-latest");
mkdirSync(latestDir, { recursive: true });
await pull(latestDir, fixtureProject.id);
check(
  readFileSync(join(latestDir, "home.tsx"), "utf8").includes("CHANGED"),
  "latest version returns the new content",
);

// ── 3. resumability ──────────────────────────────────────────────────────────
console.log("\n  resumability:");
const resumed = await pull(dst, fixtureProject.id, fixturePush.versionId);
check(
  resumed.reused > 0 && resumed.blobs === 0,
  "re-pull downloads nothing when content is already on disk",
  `(${fmt(resumed.reused)} reused, ${resumed.blobs} downloaded)`,
);

// ── 4. this repository ───────────────────────────────────────────────────────
console.log("\n  whole repository round trip:");

const repoProject = await mkProject("repo");
await push(".", repoProject.id);

const repoDst = join(tmp, "repo-dst");
mkdirSync(repoDst, { recursive: true });
const repoPull = await pull(repoDst, repoProject.id);

// Build a filtered copy of the repo containing exactly what was pushed.
const repoExpected = join(tmp, "repo-expected");
const { files } = walk(".");
for (const rel of files) {
  const dest = join(repoExpected, rel);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(rel, dest);
}

const repoDiff = diffTrees(repoExpected, repoDst);
check(repoDiff === null, `diff -r clean across ${fmt(repoPull.fileCount)} files`, repoDiff?.slice(0, 300) ?? "");

// ── 5. rejections ────────────────────────────────────────────────────────────
console.log("\n  rejections:");
const otherSignup = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", origin: ORIGIN },
  body: JSON.stringify({ name: "Other", email: `pull-other-${stamp}@example.com`, password: "correct-horse-battery" }),
});
const otherCookie = (otherSignup.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const otherCall = api(otherCookie);

const stolenManifest = await otherCall(`/api/projects/${fixtureProject.id}/manifest`);
check(stolenManifest.status === 404, "another user cannot read the manifest", `(${stolenManifest.status})`);

const stolenUrls = await otherCall(`/api/projects/${fixtureProject.id}/pull/urls`, {
  method: "POST",
  body: JSON.stringify({ hashes: [Object.values(fixturePush.manifest ?? {})[0] ?? "e".repeat(64)] }),
});
check(stolenUrls.status === 404, "another user cannot get download URLs", `(${stolenUrls.status})`);

const absentBlob = await call(`/api/projects/${fixtureProject.id}/pull/urls`, {
  method: "POST",
  body: JSON.stringify({ hashes: ["f".repeat(64)] }),
});
const absentBody = await absentBlob.json();
check(
  absentBlob.status === 200 && absentBody.missing.length === 1 && Object.keys(absentBody.downloads).length === 0,
  "absent content is reported as missing, not signed for",
);

// ── cleanup ──────────────────────────────────────────────────────────────────
await call(`/api/projects/${fixtureProject.id}`, { method: "DELETE" });
await call(`/api/projects/${repoProject.id}`, { method: "DELETE" });
rmSync(tmp, { recursive: true, force: true });

console.log(failures === 0 ? "\nPhase 4 checkpoint: PASS" : `\nPhase 4 checkpoint: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
