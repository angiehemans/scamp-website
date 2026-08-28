// Checkpoint for desktop app sign-in.
//
//   npm run dev            # in one terminal, then:
//   node scripts/check-desktop-auth.mjs
//
// Simulates what the Electron app does: generate a verifier, sign in through
// the browser session, redeem the code, and use the resulting token as a
// bearer credential against the real API.
//
// The load-bearing assertions are the ones about interception. The callback is
// a custom scheme, and on every desktop OS any application can register one, so
// the code in that URL has to be useless without the verifier. If those checks
// pass, a malicious local app that reads the callback gets nothing.

import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { signUp, markVerified, cleanUp, closeDb, BASE } from "./test-helpers.mjs";
import pg from "pg";

let bad = 0;
const ck = (ok, l, d = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? "  " + d : ""}`);
  if (!ok) bad++;
};

const stamp = Date.now();
const email = `desktop-${stamp}@example.com`;
const REDIRECT = "scamp://auth/callback";

// The HTTP calls go to BASE_URL; the assertions read DATABASE_URL. If those
// are different environments the script creates a real account on one and looks
// for it in the other — it crashes mid-run and leaves that account behind. It
// did exactly that on production once.
const remoteApi = !/localhost|127\.0\.0\.1/.test(BASE);
const localDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");
if (remoteApi && localDb) {
  console.error(
    `\n  refusing to run: API and database are different environments.\n` +
      `    API:      ${BASE}\n` +
      `    database: local\n\n` +
      `  This script signs accounts up through the API and then reads them\n` +
      `  back, so a mismatch leaves real accounts behind. To test a deployed\n` +
      `  environment, point DATABASE_URL at the same one:\n\n` +
      `    BASE_URL=${BASE} \\\n` +
      `      DATABASE_URL="$(grep '^DATABASE_URL' .env.production.local | cut -d= -f2-)" \\\n` +
      `      node scripts/check-desktop-auth.mjs\n`,
  );
  process.exit(1);
}

let sharedClient = null;
async function db(sql, params = []) {
  if (!sharedClient) {
    sharedClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
    sharedClient.on("error", () => {});
    await sharedClient.connect();
  }
  return sharedClient.query(sql, params);
}

const b64url = (b) => b.toString("base64url");
const newVerifier = () => b64url(randomBytes(48));
const challengeOf = (v) => b64url(createHash("sha256").update(v).digest());

await cleanUp(["desktop-%@example.com"]);
const user = await signUp(email, "Desktop Tester");
await markVerified(email);

const authorize = (payload) =>
  user.call("/api/desktop/authorize", {
    method: "POST",
    body: JSON.stringify(payload),
  });

const exchange = (payload) =>
  fetch(`${BASE}/api/desktop/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: BASE },
    body: JSON.stringify(payload),
  });

// ── the redirect allowlist ───────────────────────────────────────────────────

console.log("\n  redirect allowlist:");

for (const uri of [
  "https://evil.example.com/steal",
  "scamp://auth/callback/../elsewhere",
  "scamp://other",
  "javascript:alert(1)",
]) {
  const res = await authorize({
    redirectUri: uri,
    state: "abcdefgh",
    codeChallenge: challengeOf(newVerifier()),
    codeChallengeMethod: "S256",
  });
  ck(res.status === 400, `refuses ${uri.slice(0, 38)}`, `(${res.status})`);
}

const anon = await fetch(`${BASE}/api/desktop/authorize`, {
  method: "POST",
  headers: { "Content-Type": "application/json", origin: BASE },
  body: JSON.stringify({
    redirectUri: REDIRECT,
    state: "abcdefgh",
    codeChallenge: challengeOf(newVerifier()),
  }),
});
ck(anon.status === 401, "anonymous cannot authorize", `(${anon.status})`);

// ── PKCE is not optional ─────────────────────────────────────────────────────

console.log("\n  challenge validation:");

const plain = await authorize({
  redirectUri: REDIRECT,
  state: "abcdefgh",
  codeChallenge: "a-plain-verifier-value-not-a-digest-at-all",
  codeChallengeMethod: "plain",
});
ck(plain.status === 400, "refuses code_challenge_method=plain", `(${plain.status})`);

const shortState = await authorize({
  redirectUri: REDIRECT,
  state: "abc",
  codeChallenge: challengeOf(newVerifier()),
});
ck(shortState.status === 400, "refuses a too-short state", `(${shortState.status})`);

const badChallenge = await authorize({
  redirectUri: REDIRECT,
  state: "abcdefgh",
  codeChallenge: "not base64url!!",
});
ck(badChallenge.status === 400, "refuses a malformed challenge", `(${badChallenge.status})`);

// ── the happy path ───────────────────────────────────────────────────────────

console.log("\n  a real desktop sign-in:");

const verifier = newVerifier();
const state = b64url(randomBytes(16));

const authRes = await authorize({
  redirectUri: REDIRECT,
  state,
  codeChallenge: challengeOf(verifier),
  codeChallengeMethod: "S256",
});
ck(authRes.status === 200, "authorize succeeds for a signed-in browser", `(${authRes.status})`);

const { callbackUrl } = await authRes.json();
const cb = new URL(callbackUrl);
ck(callbackUrl.startsWith(REDIRECT), "callback uses the app's scheme", `(${cb.protocol}//)`);
ck(cb.searchParams.get("state") === state, "state is echoed back unmodified");
const code = cb.searchParams.get("code");
ck(Boolean(code) && code.length >= 32, "callback carries a code");
ck(
  !callbackUrl.includes("token") && !callbackUrl.includes("session"),
  "callback carries NO session token",
);

// ── interception ─────────────────────────────────────────────────────────────
//
// Everything a malicious local app could learn by reading the callback URL.

console.log("\n  a stolen code is useless:");

const wrongVerifier = await exchange({ code, codeVerifier: newVerifier() });
ck(wrongVerifier.status === 400, "cannot redeem with a different verifier", `(${wrongVerifier.status})`);

const asVerifier = await exchange({ code, codeVerifier: challengeOf(verifier) });
ck(
  asVerifier.status === 400,
  "cannot replay the challenge as the verifier",
  `(${asVerifier.status})`,
);

const madeUp = await exchange({ code: b64url(randomBytes(32)), codeVerifier: verifier });
ck(madeUp.status === 400, "cannot redeem a made-up code", `(${madeUp.status})`);

const failures = await Promise.all([wrongVerifier.json(), madeUp.json()]);
ck(
  failures[0].error === failures[1].error,
  "every failure reads the same, so guessing learns nothing",
);

// A wrong verifier burns the code, so even the real app cannot use it now.
const afterBurn = await exchange({ code, codeVerifier: verifier });
ck(
  afterBurn.status === 400,
  "a wrong guess burns the code for everyone",
  `(${afterBurn.status})`,
);

// ── redeeming properly ───────────────────────────────────────────────────────

console.log("\n  redeeming with the verifier:");

const v2 = newVerifier();
const s2 = b64url(randomBytes(16));
const auth2 = await authorize({
  redirectUri: REDIRECT,
  state: s2,
  codeChallenge: challengeOf(v2),
  codeChallengeMethod: "S256",
});
const code2 = new URL((await auth2.json()).callbackUrl).searchParams.get("code");

const ok = await exchange({ code: code2, codeVerifier: v2 });
ck(ok.status === 200, "exchange succeeds", `(${ok.status})`);

const payload = await ok.json();
ck(typeof payload.token === "string" && payload.token.length > 20, "returns a session token");
ck(payload.user?.email === email, "returns the signed-in user", `(${payload.user?.email})`);

const replay = await exchange({ code: code2, codeVerifier: v2 });
ck(replay.status === 400, "the same code cannot be redeemed twice", `(${replay.status})`);

// ── the token actually works ─────────────────────────────────────────────────

console.log("\n  using the token as a bearer credential:");

const bearer = (path, init = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      origin: BASE,
      Authorization: `Bearer ${payload.token}`,
      ...(init.headers ?? {}),
    },
  });

const projects = await bearer("/api/projects");
ck(projects.status === 200, "GET /api/projects accepts the bearer token", `(${projects.status})`);

const noToken = await fetch(`${BASE}/api/projects`, { headers: { origin: BASE } });
ck(noToken.status === 401, "and still refuses without one", `(${noToken.status})`);

const garbage = await fetch(`${BASE}/api/projects`, {
  headers: { origin: BASE, Authorization: "Bearer not-a-real-token" },
});
ck(garbage.status === 401, "and refuses a made-up token", `(${garbage.status})`);

// ── activity attribution ─────────────────────────────────────────────────────
//
// The reason lastSeenAppAt exists: before this, an API call recorded nothing
// and the desktop app was invisible to DAU/MAU entirely.

console.log("\n  activity is attributed to the right client:");

const seen = async () =>
  (
    await db(
      'select "lastSeenAt", "lastSeenAppAt" from "user" where email = $1',
      [email],
    )
  ).rows[0];

// Clear both, so what follows is unambiguous.
await db(
  'update "user" set "lastSeenAt" = null, "lastSeenAppAt" = null where email = $1',
  [email],
);

const beat = await bearer("/api/desktop/heartbeat", { method: "POST" });
ck(beat.status === 204, "heartbeat accepts the bearer token", `(${beat.status})`);

const afterBeat = await seen();
ck(Boolean(afterBeat.lastSeenAppAt), "heartbeat records app activity");
ck(
  afterBeat.lastSeenAt === null,
  "and does NOT count as a website visit",
);

// A cookie request is the website, and must not inflate the app number.
await db(
  'update "user" set "lastSeenAt" = null, "lastSeenAppAt" = null where email = $1',
  [email],
);
await user.call("/dashboard");
const afterWeb = await seen();
ck(Boolean(afterWeb.lastSeenAt), "a browser visit records web activity");
ck(
  afterWeb.lastSeenAppAt === null,
  "and does NOT count as app usage",
);

const anonBeat = await fetch(`${BASE}/api/desktop/heartbeat`, {
  method: "POST",
  headers: { origin: BASE },
});
ck(anonBeat.status === 401, "heartbeat refuses anonymous", `(${anonBeat.status})`);

// ── cleanup ──────────────────────────────────────────────────────────────────

const removed = await cleanUp(["desktop-%@example.com"]);
console.log(`\n  cleaned up ${removed} account(s)`);
console.log(bad === 0 ? "  desktop auth: PASS" : `  ${bad} FAILURE(S)`);
await sharedClient?.end().catch(() => {});
await closeDb();
process.exitCode = bad === 0 ? 0 : 1;
