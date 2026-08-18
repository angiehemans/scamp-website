// Phase 1 checkpoint for plans/cloud-backup.md.
//
// Proves the blob store round-trips content byte-identically through the URL
// protocol the Electron client will use: ask for an upload URL, PUT to it, ask
// for a download URL, GET from it, compare hashes.
//
// Binary content is included on purpose. The sync path must never transform
// file contents (Decision E) — compression is the client's job, and it happens
// at import, before a file is hashed. A lossy step anywhere in here would show
// up as a hash mismatch.
//
// Requires `npm run dev` to be running. Run: node scripts/check-blob-store.mjs

import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// Read the signing secret the same way the app does, so this script can mint
// the same local blob URLs without going through an authenticated endpoint
// (project CRUD is Phase 2).
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function blobUrl(key) {
  const expires = Math.floor(Date.now() / 1000) + 900;
  const sig = createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`${key}:${expires}`)
    .digest("hex");
  return `${BASE}/api/blobs/direct?${new URLSearchParams({ key, expires: String(expires), sig })}`;
}

const cases = [
  { name: "text (tsx)", body: Buffer.from('export default function Page() {\n  return <div>hi</div>;\n}\n') },
  { name: "text (utf-8, emoji)", body: Buffer.from("héllo — ✓ 🎨\n", "utf8") },
  { name: "binary (random 2 MiB)", body: randomBytes(2 * 1024 * 1024) },
  { name: "binary (PNG-ish header + noise)", body: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), randomBytes(64 * 1024)]) },
  { name: "empty file", body: Buffer.alloc(0) },
];

let failures = 0;
const userId = "u_check";
const projectId = "p_check";

for (const c of cases) {
  const hash = sha256(c.body);
  const key = `blobs/${userId}/${projectId}/${hash}`;

  const put = await fetch(blobUrl(key), { method: "PUT", body: c.body });
  if (put.status !== 201) {
    console.log(`  ✗ ${c.name}: upload returned ${put.status}`);
    failures++;
    continue;
  }

  const got = await fetch(blobUrl(key));
  if (got.status !== 200) {
    console.log(`  ✗ ${c.name}: download returned ${got.status}`);
    failures++;
    continue;
  }

  const back = Buffer.from(await got.arrayBuffer());
  const same = sha256(back) === hash;
  console.log(
    `  ${same ? "✓" : "✗"} ${c.name.padEnd(30)} ${String(c.body.length).padStart(8)} bytes  ${same ? "identical" : `MISMATCH (${back.length} bytes back)`}`,
  );
  if (!same) failures++;
}

// The URL is a capability: it must cover exactly one key and expire.
console.log("\n  security:");
// Upload a real blob, then try to read a *different* key using its signature.
// The key is percent-encoded in the query string, so swap the parameter rather
// than string-replacing in the URL.
const realKey = `blobs/${userId}/${projectId}/${sha256(Buffer.from("x"))}`;
await fetch(blobUrl(realKey), { method: "PUT", body: Buffer.from("x") });

const tampered = new URL(blobUrl(realKey));
tampered.searchParams.set("key", `blobs/${userId}/someone-elses-project/${sha256(Buffer.from("x"))}`);
const t = await fetch(tampered);
console.log(`  ${t.status === 403 ? "✓" : "✗"} signature does not transfer to another key (${t.status})`);
if (t.status !== 403) failures++;

const unsigned = `${BASE}/api/blobs/direct?key=${realKey}`;
const u = await fetch(unsigned);
console.log(`  ${u.status === 403 ? "✓" : "✗"} unsigned URL rejected (${u.status})`);
if (u.status !== 403) failures++;

const expiredSig = createHmac("sha256", env.BETTER_AUTH_SECRET).update(`${realKey}:1`).digest("hex");
const e = await fetch(`${BASE}/api/blobs/direct?key=${realKey}&expires=1&sig=${expiredSig}`);
console.log(`  ${e.status === 403 ? "✓" : "✗"} expired URL rejected (${e.status})`);
if (e.status !== 403) failures++;

console.log(failures === 0 ? "\nPhase 1 checkpoint: PASS" : `\nPhase 1 checkpoint: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
