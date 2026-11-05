// Checkpoint for the pay-what-you-want claim (Phase 1 of plans/paid-downloads.md).
//
//   npm run dev            # in one terminal, then:
//   node scripts/check-purchase.mjs
//
// The assertion that matters most is the one about non-zero amounts. This
// endpoint writes a revenue row without any money moving, so if it accepted a
// client-supplied amount, anyone with an account could inflate the figures on
// /admin to whatever they liked. Everything else here is ordinary validation.

import "dotenv/config";
import pg from "pg";
import { signUp, markVerified, cleanUp, feedInstaller, BASE, closeDb } from "./test-helpers.mjs";

let bad = 0;
const ck = (ok, l, d = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? "  " + d : ""}`);
  if (!ok) bad++;
};

const stamp = Date.now();
const email = `buy-${stamp}@example.com`;

async function db(sql, params = []) {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  // A late socket error with no listener is an uncaught exception.
  c.on("error", () => {});
  await c.connect();
  try {
    return await c.query(sql, params);
  } finally {
    await c.end();
  }
}

// ── fixture ──────────────────────────────────────────────────────────────────

const user = await signUp(email, "Buyer");
await markVerified(email);
const userId = (
  await db(`select id from "user" where email = $1`, [email])
).rows[0].id;

const claim = (payload) =>
  user.call("/api/download/claim", {
    method: "POST",
    body: JSON.stringify(payload),
  });

const purchases = async () =>
  (await db(`select * from "Purchase" where "userId" = $1`, [userId])).rows;

// ── the money assertion ──────────────────────────────────────────────────────

console.log("\n  a free claim cannot assert a paid amount:");

for (const amount of [5000, 100, 1]) {
  const res = await claim({ platform: "macos", amountCents: amount });
  ck(
    res.status === 400,
    `${amount} cents is refused`,
    `(${res.status})`,
  );
}
ck(
  (await purchases()).length === 0,
  "no Purchase row was written by any of those",
);

// ── validation ───────────────────────────────────────────────────────────────

console.log("\n  validation:");

const cases = [
  [{ platform: "macos", amountCents: -100 }, "negative"],
  [{ platform: "macos", amountCents: 10.5 }, "fractional cents"],
  [{ platform: "macos", amountCents: "0" }, "a string amount"],
  [{ platform: "macos", amountCents: null }, "null"],
  [{ platform: "macos" }, "a missing amount"],
  [{ platform: "solaris", amountCents: 0 }, "an unknown platform"],
  [{ amountCents: 0 }, "a missing platform"],
];
for (const [payload, label] of cases) {
  const res = await claim(payload);
  ck(res.status === 400, `${label} is refused`, `(${res.status})`);
}

const anon = await fetch(`${BASE}/api/download/claim`, {
  method: "POST",
  headers: { "Content-Type": "application/json", origin: BASE },
  body: JSON.stringify({ platform: "macos", amountCents: 0 }),
});
ck(anon.status === 401, "anonymous cannot claim", `(${anon.status})`);

ck((await purchases()).length === 0, "still no Purchase rows");

// ── the happy path ───────────────────────────────────────────────────────────

console.log("\n  claiming for free:");

const ok = await claim({ platform: "macos", amountCents: 0 });
ck(ok.status === 200, "a $0 claim succeeds", `(${ok.status})`);

const payload = await ok.json();
ck(
  payload.downloadUrl === "/api/download/macos",
  "returns the download path",
  `(${payload.downloadUrl})`,
);

const rows = await purchases();
ck(rows.length === 1, "exactly one Purchase row", `(${rows.length})`);
ck(rows[0]?.status === "free", 'status is "free"', `(${rows[0]?.status})`);
ck(rows[0]?.amountCents === 0, "amount is 0", `(${rows[0]?.amountCents})`);
ck(rows[0]?.platform === "macos", "platform recorded", `(${rows[0]?.platform})`);
ck(rows[0]?.paidAt === null, "paidAt is null for a free claim");

// The download itself is unaffected by any of this — it is gated on the
// session, never on a purchase.
const dl = await user.call("/api/download/macos", { redirect: "manual" });
ck(dl.status === 302, "the download still works after claiming", `(${dl.status})`);
ck(
  dl.headers.get("location") === (await feedInstaller("macos")).url,
  "and still points at the feed's installer",
);

// ── asked once, not every time ───────────────────────────────────────────────

console.log("\n  the prompt is not repeated:");

const dash = await user.call("/dashboard");
const html = await dash.text();
ck(
  !html.includes("Pay what you want"),
  "a user who already answered is not asked again",
);

const fresh = `buy-fresh-${stamp}@example.com`;
const other = await signUp(fresh, "Fresh Buyer");
await markVerified(fresh);
const freshHtml = await (await other.call("/dashboard")).text();
ck(
  freshHtml.includes("/api/download/") || freshHtml.includes("macOS"),
  "a new user still sees the download panel",
);

// A second claim is allowed but must not double-count: the prompt is gone, so
// this can only happen via a direct POST.
await claim({ platform: "linux", amountCents: 0 });
const after = await purchases();
ck(
  after.every((r) => r.amountCents === 0),
  "repeat claims stay at zero",
  `(${after.length} row(s))`,
);

// ── cleanup ──────────────────────────────────────────────────────────────────

const removed = await cleanUp([email, fresh]);

console.log(`\n  cleaned up ${removed} account(s)`);

console.log(bad === 0 ? "  purchase: PASS" : `  ${bad} FAILURE(S)`);
// exitCode, not exit(): process.exit() tears the process down while pg
// sockets are still closing, which surfaces as an uncaught "Connection
// terminated unexpectedly" AFTER every assertion has passed — and it
// discards buffered stdout on the way out, so the results vanish too.
// Setting the code lets Node drain and exit on its own.
await closeDb();
process.exitCode = bad === 0 ? 0 : 1;
