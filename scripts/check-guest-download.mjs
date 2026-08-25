// Checkpoint for the public marketing download flow (§4.5 of
// plans/paid-downloads.md).
//
//   npm run dev            # in one terminal, then:
//   node scripts/check-guest-download.mjs
//
// This is the only endpoint in the app with no session behind it, so the
// assertions that matter are about what it refuses: a paid amount it cannot
// corroborate, and enough requests to fill the table.

import "dotenv/config";
import { createHash, createHmac } from "node:crypto";
import pg from "pg";
import { cleanUp, parkReleases, BASE, PASSWORD } from "./test-helpers.mjs";

let bad = 0;
const ck = (ok, l, d = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? "  " + d : ""}`);
  if (!ok) bad++;
};

const stamp = Date.now();
const VERSION = `0.0.0-guest-${stamp}`;
const guestEmail = `guest-${stamp}@example.com`;

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
  if (!res.ok) throw new Error(`could not stage ${key}: ${res.status}`);
}

const guest = (payload, headers = {}) =>
  fetch(`${BASE}/api/download/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: BASE, ...headers },
    body: JSON.stringify(payload),
  });

const rowsFor = async (email) =>
  (await db(`select * from "Purchase" where email = $1`, [email])).rows;

// ── fixture ──────────────────────────────────────────────────────────────────

await db(`delete from "Release" where version like '0.0.0-%'`);
await db(`delete from "Purchase" where email like '%@example.com'`);

// Any other published release — a locally seeded one, say — would supply the
// platforms this fixture deliberately omits, making the "no build" assertion
// pass for the wrong reason. Parked for the run, restored at the end.
const unpark = await parkReleases();

const releaseId = cuid();
const body = Buffer.from(`fake dmg ${stamp}`);
const filename = `Scamp-${VERSION}.dmg`;
const key = `releases/${VERSION}/macos/${filename}`;

await db(
  `insert into "Release" (id, version, "createdAt", "publishedAt")
   values ($1, $2, now(), now())`,
  [releaseId, VERSION],
);
await putLocalBlob(key, body);
await db(
  `insert into "ReleaseAsset" (id, "releaseId", platform, key, filename, "sizeBytes", sha256)
   values ($1, $2, 'macos', $3, $4, $5, $6)`,
  [
    cuid(),
    releaseId,
    key,
    filename,
    body.length,
    createHash("sha256").update(body).digest("hex"),
  ],
);

// ── the money assertion ──────────────────────────────────────────────────────

console.log("\n  an anonymous caller cannot assert a payment:");

for (const amount of [5000, 100, 1]) {
  const res = await guest({
    email: guestEmail,
    platform: "macos",
    amountCents: amount,
  });
  ck(res.status === 400, `${amount} cents is refused`, `(${res.status})`);
}
ck((await rowsFor(guestEmail)).length === 0, "no Purchase row was written");

// ── validation ───────────────────────────────────────────────────────────────

console.log("\n  validation:");

const cases = [
  [{ platform: "macos", amountCents: 0 }, "a missing email"],
  [{ email: "not-an-email", platform: "macos", amountCents: 0 }, "a malformed email"],
  [{ email: guestEmail, platform: "solaris", amountCents: 0 }, "an unknown platform"],
  [{ email: guestEmail, amountCents: 0 }, "a missing platform"],
  [{ email: guestEmail, platform: "macos", amountCents: -1 }, "a negative amount"],
  [{ email: guestEmail, platform: "macos", amountCents: 1.5 }, "fractional cents"],
];
for (const [payload, label] of cases) {
  const res = await guest(payload);
  ck(res.status === 400, `${label} is refused`, `(${res.status})`);
}

// ── the happy path ───────────────────────────────────────────────────────────

console.log("\n  downloading without an account:");

const ok = await guest({ email: guestEmail, platform: "macos", amountCents: 0 });
ck(ok.status === 200, "a $0 guest download succeeds", `(${ok.status})`);

const data = await ok.json();
ck(Boolean(data.downloadUrl), "returns a download URL");
ck(data.filename === filename, "returns the filename", `(${data.filename})`);

const file = await fetch(data.downloadUrl);
const got = Buffer.from(await file.arrayBuffer());
ck(file.status === 200, "the URL serves the file", `(${file.status})`);
ck(got.equals(body), "bytes match what was stored");
ck(
  (file.headers.get("content-disposition") ?? "").includes(filename),
  "served as an attachment under the real name",
);

const rows = await rowsFor(guestEmail);
ck(rows.length === 1, "one Purchase row", `(${rows.length})`);
ck(rows[0]?.userId === null, "the row has no userId (it is a guest)");
ck(rows[0]?.status === "free", 'status is "free"');
ck(rows[0]?.amountCents === 0, "amount is 0");
ck(rows[0]?.email === guestEmail, "email recorded", `(${rows[0]?.email})`);

// Case is normalised, or the same person shows up twice in the numbers.
// macos, not another platform: this fixture only builds macos, so anything else
// would 404 and write no row — making this assert nothing.
await guest({
  email: guestEmail.toUpperCase(),
  platform: "macos",
  amountCents: 0,
});
const afterUpper = await rowsFor(guestEmail);
ck(
  afterUpper.length === 2,
  "an upper-case address lands on the same email",
  `(${afterUpper.length} rows)`,
);

// ── an unpublished platform ──────────────────────────────────────────────────

const noWindows = await guest({
  email: guestEmail,
  platform: "windows",
  amountCents: 0,
});
ck(
  noWindows.status === 404,
  "a platform with no build is 404, not a broken URL",
  `(${noWindows.status})`,
);

// ── signing up afterwards links the download ─────────────────────────────────

console.log("\n  creating an account afterwards:");

const signup = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", origin: BASE },
  body: JSON.stringify({
    name: "Guest Convert",
    email: guestEmail,
    password: PASSWORD,
    role: "designer",
  }),
});
ck(signup.status === 200, "can sign up with the address used to download", `(${signup.status})`);

// The link happens in a database hook, so give it a moment to land.
await new Promise((r) => setTimeout(r, 500));

const linked = await rowsFor(guestEmail);
ck(
  linked.length > 0 && linked.every((r) => r.userId !== null),
  "earlier guest downloads are attached to the new account",
  `(${linked.filter((r) => r.userId).length}/${linked.length} linked)`,
);

// ── rate limiting ────────────────────────────────────────────────────────────

console.log("\n  rate limiting:");

// cf-connecting-ip is what the route trusts. Locally there is no Cloudflare in
// front, so the header is absent and the limiter is inert — send it explicitly
// to exercise the path that runs in production.
const ip = `203.0.113.${stamp % 200}`;
const limitEmail = `flood-${stamp}@example.com`;
let limited = 0;
for (let i = 0; i < 25; i++) {
  const res = await guest(
    { email: limitEmail, platform: "macos", amountCents: 0 },
    { "cf-connecting-ip": ip },
  );
  if (res.status === 429) limited++;
}
ck(limited > 0, "a flood from one IP is eventually refused", `(${limited} of 25 blocked)`);

const otherIp = await guest(
  { email: `other-${stamp}@example.com`, platform: "macos", amountCents: 0 },
  { "cf-connecting-ip": "203.0.113.254" },
);
ck(
  otherIp.status === 200,
  "a different IP is unaffected",
  `(${otherIp.status})`,
);

// ── the page itself ──────────────────────────────────────────────────────────

console.log("\n  the public page:");

const page = await fetch(`${BASE}/download`);
const html = await page.text();
ck(page.status === 200, "/download is reachable anonymously", `(${page.status})`);
ck(!html.includes("gumroad.com"), "no Gumroad link on it");

const pricing = await fetch(`${BASE}/pricing`);
const pricingHtml = await pricing.text();
ck(
  pricingHtml.includes('href="/download"'),
  "pricing links to /download",
);
ck(!pricingHtml.includes("gumroad.com"), "pricing no longer links to Gumroad");

// ── cleanup ──────────────────────────────────────────────────────────────────

await db(`delete from "Release" where version = $1`, [VERSION]);
await db(`delete from "Purchase" where email like '%@example.com'`);
const restored = await unpark();
const removed = await cleanUp(["%@example.com"]);

console.log(`\n  cleaned up ${removed} account(s) and 1 test release`);
if (restored > 0) {
  console.log(`  restored ${restored} pre-existing published release(s)`);
}
console.log(bad === 0 ? "  guest download: PASS" : `  ${bad} FAILURE(S)`);
process.exit(bad === 0 ? 0 : 1);
