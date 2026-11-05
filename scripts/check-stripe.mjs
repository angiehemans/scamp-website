// Checkpoint for the Stripe pay-what-you-want flow (Phase 2 of
// plans/paid-downloads.md).
//
//   npm run dev            # in one terminal, then:
//   node scripts/check-stripe.mjs
//
// Runs in two modes:
//
//   no STRIPE_SECRET_KEY  → checks only that everything degrades safely, which
//                           is the state the site actually ships in today
//   test key present      → the full flow, including a real test-mode Checkout
//                           Session and a signed webhook
//
// A live key (sk_live_) is refused outright. This script creates sessions and
// writes purchase rows; pointing it at the real account would put fictitious
// revenue in your books.

import "dotenv/config";
import { createHmac } from "node:crypto";
import pg from "pg";
import { signUp, markVerified, cleanUp, feedInstaller, BASE } from "./test-helpers.mjs";

let bad = 0;
const ck = (ok, l, d = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${l}${d ? "  " + d : ""}`);
  if (!ok) bad++;
};

const KEY = process.env.STRIPE_SECRET_KEY ?? "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

if (KEY.startsWith("sk_live_")) {
  console.error(
    "\n  refusing to run against a LIVE Stripe key.\n" +
      "  This script creates checkout sessions and purchase rows.\n",
  );
  process.exit(1);
}

const live = KEY.startsWith("sk_test_");
const stamp = Date.now();
const email = `stripe-${stamp}@example.com`;

async function db(sql, params = []) {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    return await c.query(sql, params);
  } finally {
    await c.end();
  }
}
const post = (path, payload, headers = {}) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: BASE, ...headers },
    body: JSON.stringify(payload),
  });

// ── fixture ──────────────────────────────────────────────────────────────────

await db(`delete from "Purchase" where email like '%@example.com'`);
// Downloads come from the update feed (lib/releases.ts); nothing to plant.
const mac = await feedInstaller("macos");

console.log(
  live
    ? "\n  Stripe test key present — running the full flow\n"
    : "\n  No STRIPE_SECRET_KEY — checking safe degradation only\n",
);

// ── amount rules, which apply either way ─────────────────────────────────────

console.log("  amount rules:");

// Below the floor there is nothing chargeable, so it must not reach Stripe.
const tooSmall = await post("/api/download/checkout", {
  platform: "macos",
  amountCents: 50,
  email,
});
ck(
  tooSmall.status === 400 || (!live && tooSmall.status === 503),
  "an amount under $1 is refused before Stripe",
  `(${tooSmall.status})`,
);

// The free endpoints must still refuse to record money, whatever Stripe is up
// to. This is the property that keeps /admin honest.
const fakeRevenue = await post("/api/download/guest", {
  email,
  platform: "macos",
  amountCents: 5000,
});
ck(
  fakeRevenue.status === 400,
  "the free guest endpoint still refuses a paid amount",
  `(${fakeRevenue.status})`,
);

// ── webhook, which is testable without a key for the failure cases ───────────

console.log("\n  webhook:");

const noSig = await post("/api/stripe/webhook", { type: "checkout.session.completed" });
ck(noSig.status === 400, "no signature is rejected", `(${noSig.status})`);

const badSig = await post(
  "/api/stripe/webhook",
  { type: "checkout.session.completed" },
  { "stripe-signature": "t=1,v1=deadbeef" },
);
ck(badSig.status === 400, "a forged signature is rejected", `(${badSig.status})`);

if (!live) {
  console.log("\n  degradation:");
  const checkout = await post("/api/download/checkout", {
    platform: "macos",
    amountCents: 2500,
    email,
  });
  ck(checkout.status === 503, "checkout reports unavailable", `(${checkout.status})`);

  const fulfil = await post("/api/download/fulfil", { sessionId: "cs_test_nope" });
  ck(fulfil.status === 503, "fulfil reports unavailable", `(${fulfil.status})`);

  const free = await post("/api/download/guest", {
    email,
    platform: "macos",
    amountCents: 0,
  });
  ck(free.status === 200, "free downloads are unaffected", `(${free.status})`);

  const page = await fetch(`${BASE}/download`);
  const html = await page.text();
  ck(
    html.includes("Pay what you want") || html.includes("Download Scamp"),
    "the page still renders",
  );
}

// ── the full flow, test key only ─────────────────────────────────────────────

if (live) {
  console.log("\n  creating a checkout session:");

  const user = await signUp(email, "Stripe Tester");
  await markVerified(email);

  const res = await user.call("/api/download/checkout", {
    method: "POST",
    body: JSON.stringify({ platform: "macos", amountCents: 2500 }),
  });
  ck(res.status === 200, "a signed-in checkout succeeds", `(${res.status})`);

  const created = await res.json();

  // Elements mode: the form renders on our own page, so there is no hosted
  // Checkout URL — the client secret is what initialises it.
  ck(
    typeof created.clientSecret === "string" &&
      created.clientSecret.startsWith("cs_"),
    "returns a client secret for the embedded form",
  );
  ck(
    !("url" in created),
    "no hosted checkout URL — the customer never leaves the site",
  );
  // The file has to start transferring before the form appears.
  ck(
    created.downloadUrl === mac.url,
    "returns the feed's installer URL too, so it can start before payment",
    `(${created.downloadUrl})`,
  );

  // Redirects must go to the origin the browser is actually on. Using the
  // canonical production URL sent anyone testing locally to the live site.
  // In Elements mode this is return_url, used only by payment methods that
  // redirect away to authenticate (3D Secure) and come back.
  const origin = process.env.BETTER_AUTH_URL ?? BASE;
  const stripeSession = await (
    await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${created.sessionId}`,
      { headers: { Authorization: `Bearer ${KEY}` } },
    )
  ).json();
  ck(
    stripeSession.ui_mode === "elements",
    "the session is in elements mode",
    `(${stripeSession.ui_mode})`,
  );
  ck(
    stripeSession.automatic_tax?.enabled === true,
    "automatic tax is still enabled in elements mode",
  );
  ck(
    (stripeSession.return_url ?? "").startsWith(origin),
    "return_url points at this environment, not production",
    `(${(stripeSession.return_url ?? "unavailable").slice(0, 55)})`,
  );
  ck(
    (stripeSession.return_url ?? "").includes("/download/thanks"),
    "and lands on the thank-you page",
  );

  // The publishable key has to reach the browser at runtime, not build time —
  // this page is static and the secret does not exist during the build.
  const cfg = await (await fetch(`${BASE}/api/download/payment-config`)).json();
  ck(cfg.canPay === true, "payment config reports payments available");
  ck(
    typeof cfg.publishableKey === "string" &&
      cfg.publishableKey.startsWith("pk_"),
    "payment config serves a publishable key",
    `(${cfg.publishableKey ? cfg.publishableKey.slice(0, 8) + "…" : "missing"})`,
  );

  const rows = await db(
    `select * from "Purchase" where email = $1 order by "createdAt" desc`,
    [email],
  );
  const pending = rows.rows[0];

  // Without a session there is nothing left to assert, and every following
  // check would fail on undefined rather than telling you what went wrong.
  // The dev server log has the reason Stripe gave.
  if (!pending) {
    console.error(
      "\n  no Purchase row — session creation failed. The reason is in the" +
        "\n  dev server output, logged as [checkout].\n",
    );
    await db(`delete from "Purchase" where email like '%@example.com'`);
    await cleanUp(["%@example.com"]);
    process.exit(1);
  }
  ck(pending?.status === "pending", 'the row starts "pending"', `(${pending?.status})`);
  ck(pending?.amountCents === 2500, "amount recorded", `(${pending?.amountCents})`);
  ck(Boolean(pending?.stripeSessionId), "session id recorded");
  ck(pending?.paidAt === null, "paidAt is null until money arrives");

  // A Customer should exist for a signed-in buyer, because Billing will need
  // one for the Pro tier.
  const u = await db(`select "stripeCustomerId" from "user" where email = $1`, [
    email,
  ]);
  ck(
    Boolean(u.rows[0]?.stripeCustomerId),
    "a Stripe Customer was created for the account",
  );

  // Fulfilment must refuse an unpaid session — this is what stops someone
  // reading a session id out of a URL and collecting a free download.
  const early = await post("/api/download/fulfil", {
    sessionId: pending.stripeSessionId,
  });
  ck(
    early.status === 402,
    "fulfil refuses a session that has not been paid",
    `(${early.status})`,
  );

  // ── signed webhook ─────────────────────────────────────────────────────────

  if (WEBHOOK_SECRET) {
    console.log("\n  signed webhook:");

    const event = {
      id: `evt_test_${stamp}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: pending.stripeSessionId,
          payment_status: "paid",
          payment_intent: `pi_test_${stamp}`,
          amount_total: 2500,
          currency: "usd",
          metadata: { platform: "macos", email, userId: "" },
        },
      },
    };
    const payload = JSON.stringify(event);
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", WEBHOOK_SECRET)
      .update(`${ts}.${payload}`)
      .digest("hex");
    const header = `t=${ts},v1=${sig}`;

    const hook = await fetch(`${BASE}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": header },
      body: payload,
    });
    ck(hook.status === 200, "a correctly signed event is accepted", `(${hook.status})`);

    const afterHook = await db(
      `select status, "paidAt" from "Purchase" where "stripeSessionId" = $1`,
      [pending.stripeSessionId],
    );
    ck(afterHook.rows[0]?.status === "paid", 'the row becomes "paid"');
    ck(Boolean(afterHook.rows[0]?.paidAt), "paidAt is set");

    // The one that matters: Stripe redelivers, and a second write would double
    // the revenue figures.
    const replay = await fetch(`${BASE}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": header },
      body: payload,
    });
    const replayBody = await replay.json();
    ck(replay.status === 200, "a redelivered event is accepted", `(${replay.status})`);
    ck(replayBody.duplicate === true, "and recognised as a duplicate");

    const paidRows = await db(
      `select count(*)::int as n from "Purchase" where "stripeSessionId" = $1 and status = 'paid'`,
      [pending.stripeSessionId],
    );
    ck(paidRows.rows[0].n === 1, "still exactly one paid row", `(${paidRows.rows[0].n})`);

    // ── money arriving for a session we have no row for ──────────────────────
    //
    // createCheckout writes the Stripe session first and the Purchase row
    // second. If that write fails, a real payment lands with nothing recording
    // it. Simulated by deleting the row and replaying.
    console.log("\n  recovery when the row is missing:");

    await db(`delete from "Purchase" where "stripeSessionId" = $1`, [
      pending.stripeSessionId,
    ]);
    await db(`delete from "StripeEvent" where id = $1`, [event.id]);

    const recovery = { ...event, id: `evt_test_recover_${stamp}` };
    const rPayload = JSON.stringify(recovery);
    const rTs = Math.floor(Date.now() / 1000);
    const rSig = createHmac("sha256", WEBHOOK_SECRET)
      .update(`${rTs}.${rPayload}`)
      .digest("hex");

    const recovered = await fetch(`${BASE}/api/stripe/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": `t=${rTs},v1=${rSig}`,
      },
      body: rPayload,
    });
    ck(recovered.status === 200, "the replayed event is accepted", `(${recovered.status})`);

    const rebuilt = await db(
      `select status, email, platform from "Purchase" where "stripeSessionId" = $1`,
      [pending.stripeSessionId],
    );
    ck(rebuilt.rowCount === 1, "the missing row is rebuilt", `(${rebuilt.rowCount})`);
    ck(rebuilt.rows[0]?.status === "paid", "rebuilt as paid");
    ck(
      rebuilt.rows[0]?.email === email,
      "with the buyer's email from session metadata",
      `(${rebuilt.rows[0]?.email})`,
    );
  } else {
    console.log("\n  (no STRIPE_WEBHOOK_SECRET — skipping signed webhook checks)");
  }
}

// ── cleanup ──────────────────────────────────────────────────────────────────

await db(`delete from "Purchase" where email like '%@example.com'`);
await db(`delete from "StripeEvent" where id like 'evt_test_%'`);
const removed = await cleanUp(["%@example.com"]);

console.log(`\n  cleaned up ${removed} account(s)`);
console.log(bad === 0 ? "  stripe: PASS" : `  ${bad} FAILURE(S)`);
process.exit(bad === 0 ? 0 : 1);
