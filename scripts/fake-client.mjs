// A stand-in for the Electron sync client, and the reference implementation of
// the push protocol in plans/cloud-backup.md.
//
// The Electron app will do exactly this: walk the project applying ignore
// rules, hash what remains, ask the server what it is missing, upload only
// that, then commit.
//
// Usage:
//   node scripts/fake-client.mjs scan <dir>                 what would be pushed
//   node scripts/fake-client.mjs push <dir> --project <id>  push it
//   node scripts/fake-client.mjs pull <dir> --project <id>  restore it
//
// Auth: set SCAMP_COOKIE, or SCAMP_EMAIL + SCAMP_PASSWORD to sign in.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import ignore from "ignore";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// Better Auth rejects a present-but-null Origin (MISSING_OR_NULL_ORIGIN), which
// is what Node's fetch sends. The real client must send a matching Origin too.
const ORIGIN = BASE;

/**
 * Excluded no matter what .gitignore says.
 *
 * node_modules is ~68,000 files and regenerable — Scamp already runs
 * `npm install` on first preview, so a restored project rebuilds it. Letting a
 * user opt into syncing it by editing .gitignore would be a footgun, not a
 * feature.
 */
const ALWAYS_IGNORE = ["node_modules", ".git", ".next", ".open-next", ".DS_Store"];

/**
 * Fallback for projects with no .gitignore. Scamp creates the project folder
 * rather than running `git init`, so many will not have one.
 */
const DEFAULT_IGNORE = [...ALWAYS_IGNORE, "out", "dist", "build", ".env*", "*.log"];

/**
 * Builds the ignore matcher for a project.
 *
 * NOTE for the real client: this reads only the root .gitignore. Git also
 * honours nested .gitignore files in subdirectories, which the `ignore` package
 * does not compose automatically. Worth adding if projects turn out to use them.
 */
function buildMatcher(root) {
  const ig = ignore().add(ALWAYS_IGNORE);
  let source = "defaults (no .gitignore found)";
  try {
    ig.add(readFileSync(join(root, ".gitignore"), "utf8"));
    source = ".gitignore";
  } catch {
    ig.add(DEFAULT_IGNORE);
  }
  return { ig, source };
}

/** Walks the project, skipping ignored paths. Returns relative POSIX paths. */
function walk(root) {
  const { ig, source } = buildMatcher(root);
  const files = [];
  let skipped = 0;

  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      const rel = relative(root, abs).split(sep).join("/");
      // Directories must be tested with a trailing slash for git semantics.
      if (ig.ignores(entry.isDirectory() ? `${rel}/` : rel)) {
        skipped++;
        continue;
      }
      if (entry.isDirectory()) visit(abs);
      else if (entry.isFile()) files.push(rel);
    }
  };

  visit(root);
  return { files, skipped, source };
}

function buildManifest(root, files) {
  const manifest = {};
  let bytes = 0;
  for (const rel of files) {
    const content = readFileSync(join(root, rel));
    manifest[rel] = createHash("sha256").update(content).digest("hex");
    bytes += content.length;
  }
  return { manifest, bytes };
}

// ── auth ─────────────────────────────────────────────────────────────────────

async function cookieHeader() {
  if (process.env.SCAMP_COOKIE) return process.env.SCAMP_COOKIE;
  const email = process.env.SCAMP_EMAIL;
  const password = process.env.SCAMP_PASSWORD;
  if (!email || !password) {
    throw new Error("Set SCAMP_COOKIE, or SCAMP_EMAIL and SCAMP_PASSWORD");
  }
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in failed: ${res.status}`);
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

function api(cookie) {
  return (path, init = {}) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        origin: ORIGIN,
        cookie,
        ...(init.headers ?? {}),
      },
    });
}

// ── commands ─────────────────────────────────────────────────────────────────

const fmt = (n) => n.toLocaleString("en-US");

async function scan(dir) {
  const { files, skipped, source } = walk(dir);
  const { bytes } = buildManifest(dir, files);
  console.log(`  ignore source : ${source}`);
  console.log(`  would upload  : ${fmt(files.length)} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  entries skipped: ${fmt(skipped)}`);
}

async function push(dir, projectId) {
  const cookie = await cookieHeader();
  const call = api(cookie);

  const t0 = Date.now();
  const { files, source } = walk(dir);
  const { manifest, bytes } = buildManifest(dir, files);
  console.log(`  walked ${fmt(files.length)} files (${(bytes / 1024 / 1024).toFixed(2)} MB) via ${source}`);

  const prepRes = await call(`/api/projects/${projectId}/push/prepare`, {
    method: "POST",
    body: JSON.stringify({ manifest }),
  });
  if (!prepRes.ok) throw new Error(`prepare failed: ${prepRes.status} ${await prepRes.text()}`);
  const prep = await prepRes.json();
  console.log(`  server has ${fmt(prep.have)}, needs ${fmt(prep.missing)}  (direct to R2: ${prep.direct})`);

  // Upload only what is missing. Content is keyed by hash, so two paths with
  // identical content upload once.
  const hashToPath = new Map();
  for (const [path, hash] of Object.entries(manifest)) {
    if (!hashToPath.has(hash)) hashToPath.set(hash, path);
  }

  const entries = Object.entries(prep.uploads);
  let uploaded = 0;
  const CONCURRENCY = 16;
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    await Promise.all(
      entries.slice(i, i + CONCURRENCY).map(async ([hash, url]) => {
        const body = readFileSync(join(dir, hashToPath.get(hash)));
        const res = await fetch(url, { method: "PUT", body });
        if (!res.ok) throw new Error(`upload ${hash.slice(0, 8)} failed: ${res.status}`);
        uploaded++;
      }),
    );
  }
  console.log(`  uploaded ${fmt(uploaded)} blobs`);

  const commitRes = await call(`/api/projects/${projectId}/push/commit`, {
    method: "POST",
    body: JSON.stringify({ manifest, deviceId: process.env.SCAMP_DEVICE_ID ?? "fake-client" }),
  });
  if (!commitRes.ok) throw new Error(`commit failed: ${commitRes.status} ${await commitRes.text()}`);
  const commit = await commitRes.json();
  console.log(
    `  committed version ${commit.versionId} — ${fmt(commit.fileCount)} files, ` +
      `${(commit.totalBytes / 1024 / 1024).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  return { uploaded, ...commit };
}

/**
 * Restore a project into `dir`.
 *
 * Content-addressed storage makes this resumable for free: anything already on
 * disk with the right hash is skipped, so an interrupted restore picks up where
 * it stopped rather than re-downloading everything.
 */
async function pull(dir, projectId, versionId) {
  const cookie = await cookieHeader();
  const call = api(cookie);
  const t0 = Date.now();

  const query = versionId ? `?version=${encodeURIComponent(versionId)}` : "";
  const manRes = await call(`/api/projects/${projectId}/manifest${query}`);
  if (!manRes.ok) throw new Error(`manifest failed: ${manRes.status} ${await manRes.text()}`);
  const { manifest, versionId: got, createdAt, fileCount } = await manRes.json();
  console.log(`  version ${got} (${createdAt}) — ${fmt(fileCount)} files`);

  // Skip content already present locally with the right hash.
  const needed = new Set();
  let reused = 0;
  for (const [rel, hash] of Object.entries(manifest)) {
    let local = null;
    try {
      local = createHash("sha256").update(readFileSync(join(dir, rel))).digest("hex");
    } catch {
      /* absent */
    }
    if (local === hash) reused++;
    else needed.add(hash);
  }
  if (reused > 0) console.log(`  ${fmt(reused)} file(s) already correct on disk`);

  const urlRes = await call(`/api/projects/${projectId}/pull/urls`, {
    method: "POST",
    body: JSON.stringify({ hashes: [...needed] }),
  });
  if (!urlRes.ok) throw new Error(`pull/urls failed: ${urlRes.status} ${await urlRes.text()}`);
  const { downloads, missing } = await urlRes.json();
  if (missing.length > 0) {
    throw new Error(`server is missing ${missing.length} blob(s) this version references`);
  }

  // Fetch each blob once, then write it to every path that references it.
  const byHash = new Map();
  for (const [rel, hash] of Object.entries(manifest)) {
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(rel);
  }

  const entries = Object.entries(downloads);
  let written = 0;
  const CONCURRENCY = 16;
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    await Promise.all(
      entries.slice(i, i + CONCURRENCY).map(async ([hash, url]) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`download ${hash.slice(0, 8)} failed: ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());

        const actual = createHash("sha256").update(buf).digest("hex");
        if (actual !== hash) {
          throw new Error(`content hash mismatch for ${hash.slice(0, 8)} — refusing to write`);
        }

        for (const rel of byHash.get(hash)) {
          const dest = join(dir, rel);
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, buf);
          written++;
        }
      }),
    );
  }

  console.log(
    `  restored ${fmt(written)} file(s) from ${fmt(entries.length)} blob(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  return { versionId: got, written, reused, blobs: entries.length, fileCount };
}

// Only act as a CLI when run directly, so the checkpoint can import the
// protocol implementation rather than reimplementing it.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [cmd, dir, ...rest] = process.argv.slice(2);
  const projectId = rest[rest.indexOf("--project") + 1];

  const versionId = rest.includes("--version") ? rest[rest.indexOf("--version") + 1] : undefined;

  if (cmd === "scan" && dir) await scan(dir);
  else if (cmd === "push" && dir && projectId) await push(dir, projectId);
  else if (cmd === "pull" && dir && projectId) await pull(dir, projectId, versionId);
  else {
    console.log("usage: fake-client.mjs scan <dir>");
    console.log("       fake-client.mjs push <dir> --project <id>");
    console.log("       fake-client.mjs pull <dir> --project <id> [--version <id>]");
    process.exit(1);
  }
}

export { walk, buildManifest, push, pull, api, cookieHeader, ORIGIN, BASE };
