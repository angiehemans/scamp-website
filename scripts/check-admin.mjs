// Checkpoint for the admin metrics page.
//
// Two things are being proved. The first is access control, which is the part
// that matters: /admin must be invisible to anonymous visitors, to signed-in
// users who are not on the allowlist, and to a listed address whose account has
// not been verified. All three get a 404 rather than a 403 — a 403 confirms the
// page exists and is worth attacking.
//
// The second is that the page actually renders its four tiles, three panels and
// a full 30-day chart, so a broken query surfaces here rather than the first
// time it is opened.
//
// The third is the Cloud switch: an admin can turn cloud on for their own
// account with no payment plan, the sync API opens and closes with it, and
// nobody else can reach the switch at all.
//
// Both the dev server and this script need the same throwaway admin address,
// because the script signs that account up and deletes it afterwards. Pass it
// inline to both — dotenv does not overwrite a variable that is already set, so
// the inline value wins over .env:
//
//   ADMIN_EMAILS="admin-check@example.com" npm run dev
//   ADMIN_EMAILS="admin-check@example.com" node scripts/check-admin.mjs
//
// It refuses to run unless the first listed address is @example.com, so it can
// never sign up as — or delete — a real admin.

import "dotenv/config";
import { signUp, markVerified, cleanUp, BASE, closeDb } from "./test-helpers.mjs";

let bad = 0;
const ck = (ok, l, d = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? "  " + d : ""}`);
  if (!ok) bad++;
};

const ADMIN = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();

if (!ADMIN?.endsWith("@example.com")) {
  console.error(
    `\n  ADMIN_EMAILS must start with a throwaway @example.com address.\n` +
      `  Got: ${ADMIN || "(unset)"}\n\n` +
      `  Run both the server and this script with the override:\n` +
      `    ADMIN_EMAILS="admin-check@example.com" npm run dev\n` +
      `    ADMIN_EMAILS="admin-check@example.com" node scripts/check-admin.mjs\n`,
  );
  process.exit(1);
}

const stamp = Date.now();
const outsider = `notadmin-${stamp}@example.com`;

// A crashed earlier run leaves these accounts behind, and sign-up then fails
// with a 422 that looks nothing like the real problem. Clear them first.
await cleanUp([ADMIN, "notadmin-%@example.com"]);

// --- access control ---------------------------------------------------------

const anon = await fetch(`${BASE}/admin`);
ck(anon.status === 404, "anonymous cannot reach /admin", `(${anon.status})`);

const other = await signUp(outsider, "Not Admin");
await markVerified(outsider);
const otherRes = await other.call("/admin");
ck(
  otherRes.status === 404,
  "signed-in non-admin gets 404, not 403",
  `(${otherRes.status})`,
);

// The listed address, before verification. Being on the allowlist is not
// enough — otherwise anyone who knew the list could register an address that
// had not signed up yet and read the page.
const admin = await signUp(ADMIN, "Angie Admin");
const unverified = await admin.call("/admin");
ck(
  unverified.status === 404,
  "listed but unverified is still 404",
  `(${unverified.status})`,
);

await markVerified(ADMIN);
const ok = await admin.call("/admin");
ck(ok.status === 200, "listed and verified gets the page", `(${ok.status})`);

// A 404 here almost always means the dev server was started without the
// override, so it is reading a different allowlist from this script. Say so,
// rather than letting eleven content assertions fail against a 404 body and
// look like the page is broken.
if (ok.status === 404) {
  console.error(
    `\n  ${ADMIN} is on this script's allowlist but the server disagrees.\n` +
      `  Restart it with the same override:\n` +
      `    ADMIN_EMAILS="${ADMIN}" npm run dev\n`,
  );
  await cleanUp([ADMIN, "notadmin-%@example.com"]);
  process.exit(1);
}

// --- content ----------------------------------------------------------------

// React separates interpolated text from adjacent literals with an empty HTML
// comment, so "Active, last {N} days" ships as "Active, last <!-- -->30<!-- -->
// days". Strip those before matching, or every assertion that spans a value
// fails for a reason that has nothing to do with the page being right.
const html = (ok.status === 200 ? await ok.text() : "").replaceAll("<!-- -->", "");
const has = (needle) => html.includes(needle);

ck(has("Total sign-ups"), "total sign-ups tile");
ck(has("Sign-ups, last 7 days"), "7-day tile");
// App and web are separate tiles now: "opened the site" and "used Scamp" are
// different questions and the page has to answer both.
ck(has("In the app, last 24h"), "app DAU tile");
ck(has("In the app, last 30 days"), "app MAU tile");
ck(has("on the website"), "web figure shown alongside");
ck(has("Sign-ups, last 30 days"), "signups chart");
ck(has("What people say they do"), "role breakdown");
ck(has("Recent sign-ups"), "user list");
ck(has("Downloads, last 30 days"), "downloads chart");
ck(has("Emails without an account"), "guest email list");
ck(has("Emails, no account"), "emails-without-account tile");
ck(has("What \u201Cactive\u201D measures"), "measurement caveat");

// One bar per day, always — days with no sign-ups still occupy the axis, or the
// chart silently compresses a quiet week into a busy-looking one.
const bars = (html.match(/role="img" aria-label="[^"]*sign-up/g) ?? []).length;
ck(bars === 30, "30 sign-up bars, one per day", `(${bars})`);
const dlBars = (html.match(/role="img" aria-label="[^"]*download/g) ?? []).length;
ck(dlBars === 30, "30 download bars, one per day", `(${dlBars})`);

// The dashboard shows the way in, but only to an admin.
const dash = await admin.call("/dashboard");
const dashHtml = await dash.text();
ck(dashHtml.includes('href="/admin"'), "dashboard links to /admin for admins");

const otherDash = await other.call("/dashboard");
ck(
  !(await otherDash.text()).includes('href="/admin"'),
  "dashboard hides the link from everyone else",
);

// --- cloud switch -----------------------------------------------------------

console.log("\n  cloud switch:");

const cloud = (who, enabled) =>
  who.call("/api/account/cloud", {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });

// Off by default: an admin is not entitled just by being an admin. They have
// to switch it on, and until then the sync API says so with a 402.
const before = await admin.call("/api/projects");
const beforeBody = await before.json().catch(() => ({}));
ck(
  before.status === 402 && beforeBody.code === "PRO_REQUIRED",
  "admin without cloud gets 402 PRO_REQUIRED from the sync API",
  `(${before.status} ${beforeBody.code})`,
);
ck(dashHtml.includes("Switch on Cloud"), "admin dashboard shows the switch, off");
ck(
  !(await (await other.call("/dashboard")).text()).includes("Switch on Cloud"),
  "non-admin dashboard has no switch",
);

const anonSwitch = await fetch(`${BASE}/api/account/cloud`, {
  method: "POST",
  headers: { "Content-Type": "application/json", origin: BASE },
  body: JSON.stringify({ enabled: true }),
});
ck(anonSwitch.status === 401, "anonymous cannot use the switch", `(${anonSwitch.status})`);

const otherSwitch = await cloud(other, true);
ck(otherSwitch.status === 404, "non-admin gets 404 from the switch, not 403", `(${otherSwitch.status})`);
const otherAfter = await other.call("/api/projects");
ck(otherAfter.status === 402, "…and is still not entitled", `(${otherAfter.status})`);

// Strings are refused, not coerced: "false" must never switch cloud on.
const coerced = await cloud(admin, "true");
ck(coerced.status === 400, "non-boolean enabled is a 400", `(${coerced.status})`);

const on = await cloud(admin, true);
const onBody = await on.json().catch(() => ({}));
ck(
  on.status === 200 && onBody.cloud?.enabled === true && typeof onBody.cloud?.since === "string",
  "admin switches cloud on",
  `(${on.status} enabled=${onBody.cloud?.enabled})`,
);
const during = await admin.call("/api/projects");
ck(during.status === 200, "sync API opens for the admin", `(${during.status})`);
const onDash = await (await admin.call("/dashboard")).text();
ck(onDash.includes("Switch off Cloud"), "dashboard shows the switch, on");

// Switching on twice keeps the original "since": it is when cloud was granted,
// not the last time the button was pressed.
const again = await cloud(admin, true);
const againBody = await again.json().catch(() => ({}));
ck(againBody.cloud?.since === onBody.cloud?.since, "switching on again keeps the since date");

const off = await cloud(admin, false);
const offBody = await off.json().catch(() => ({}));
ck(
  off.status === 200 && offBody.cloud?.enabled === false && offBody.cloud?.since === null,
  "admin switches cloud off",
  `(${off.status} enabled=${offBody.cloud?.enabled})`,
);
const after = await admin.call("/api/projects");
ck(after.status === 402, "sync API closes again", `(${after.status})`);

// --- cleanup ----------------------------------------------------------------

const removed = await cleanUp([ADMIN, "notadmin-%@example.com"]);
console.log(`\n  cleaned up ${removed} test account(s)`);
console.log(bad === 0 ? "  admin view: PASS" : `  ${bad} FAILURE(S)`);
// exitCode, not exit(): process.exit() tears the process down while pg
// sockets are still closing, which surfaces as an uncaught "Connection
// terminated unexpectedly" AFTER every assertion has passed — and it
// discards buffered stdout on the way out, so the results vanish too.
// Setting the code lets Node drain and exit on its own.
await closeDb();
process.exitCode = bad === 0 ? 0 : 1;
