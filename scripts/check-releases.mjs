// Checkpoint for installer downloads (lib/releases.ts, /api/download/<platform>).
//
//   npm run dev            # in one terminal, then:
//   node scripts/check-releases.mjs
//
// Downloads come from the update feed at updates.scamp.club, the same
// manifests the desktop app updates from, so there is no local fixture to
// plant: this compares what the app redirects to against the live manifest.
// Needs network access to the feed.
//
// The load-bearing assertion is still about what is NOT served: an anonymous
// request must never reach an installer through this route.

import "dotenv/config";
import { signUp, markVerified, cleanUp, feedInstaller, BASE, closeDb } from "./test-helpers.mjs";

let bad = 0;
const ck = (ok, l, d = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? "  " + d : ""}`);
  if (!ok) bad++;
};

const stamp = Date.now();
const email = `release-${stamp}@example.com`;

const user = await signUp(email, "Release Check");
await markVerified(email);

// ── who may download ─────────────────────────────────────────────────────────

console.log("\n  access:");

const anon = await fetch(`${BASE}/api/download/macos`, { redirect: "manual" });
ck(anon.status === 401, "anonymous cannot download", `(${anon.status})`);

const unknown = await user.call("/api/download/solaris", { redirect: "manual" });
ck(unknown.status === 404, "an unknown platform is 404", `(${unknown.status})`);

// ── every platform redirects to the feed's current installer ─────────────────

console.log("\n  redirects match the feed:");

for (const platform of ["macos", "windows", "linux"]) {
  const expected = await feedInstaller(platform);
  const res = await user.call(`/api/download/${platform}`, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  ck(res.status === 302, `${platform} redirects`, `(${res.status})`);
  ck(
    location === expected.url,
    `${platform} points at ${expected.filename}`,
    location === expected.url ? "" : `(got ${location || "nothing"})`,
  );
}

// HEAD, not GET: proves the installer exists without pulling ~150 MB.
const mac = await feedInstaller("macos");
const head = await fetch(mac.url, { method: "HEAD" });
ck(head.status === 200, "the macOS installer exists on the feed", `(${head.status})`);

// ── dashboard ────────────────────────────────────────────────────────────────

console.log("\n  dashboard:");

const dashHtml = await (await user.call("/dashboard")).text();
ck(dashHtml.includes(mac.version), `shows the feed version (${mac.version})`);
// The platform controls are buttons in a client component, not anchors, so
// there is no href to assert on; this only checks the panel renders.
ck(dashHtml.includes("macOS"), "renders the platform controls");
ck(!dashHtml.includes("gumroad.com"), "no Gumroad link remains on the dashboard");

// ── cleanup ──────────────────────────────────────────────────────────────────

const removed = await cleanUp([email]);
console.log(`\n  cleaned up ${removed} account(s)`);

console.log(bad === 0 ? "  releases: PASS" : `  ${bad} FAILURE(S)`);
// exitCode, not exit(): process.exit() tears the process down while pg
// sockets are still closing, which surfaces as an uncaught "Connection
// terminated unexpectedly" AFTER every assertion has passed — and it
// discards buffered stdout on the way out, so the results vanish too.
// Setting the code lets Node drain and exit on its own.
await closeDb();
process.exitCode = bad === 0 ? 0 : 1;
