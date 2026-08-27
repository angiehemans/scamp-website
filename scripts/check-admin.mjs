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
ck(has("Active, last 24h"), "DAU tile");
ck(has("Active, last 30 days"), "MAU tile");
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
