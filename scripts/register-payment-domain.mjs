// Registers a domain with Stripe so wallet payment methods can appear.
//
//   node scripts/register-payment-domain.mjs                 # list what is registered
//   node scripts/register-payment-domain.mjs www.scamp.club  # register one
//
// ── Why this is needed ──────────────────────────────────────────────────────
// Apple Pay, Google Pay and Link only render in Elements or the embedded
// Checkout form on domains registered to the Stripe account. Stripe's own
// hosted page does not need this — it is on stripe.com — which is exactly why
// moving the form onto our site introduces the requirement.
//
// Register once per domain and it applies to every wallet, now and in future.
// Test and live mode are separate: the key you run this with decides which.
//
// localhost cannot be registered. Wallets therefore will not appear locally,
// which is expected and not a bug — verify them on a deployed URL.

import "dotenv/config";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("  STRIPE_SECRET_KEY is not set");
  process.exit(1);
}

const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
const mode = key.startsWith("sk_live_") ? "LIVE" : "test";
const domain = process.argv[2];

console.log(`\n  Stripe mode: ${mode}`);

if (!domain) {
  const { data } = await stripe.paymentMethodDomains.list({ limit: 20 });
  if (data.length === 0) {
    console.log("  no domains registered — wallets will not appear\n");
  } else {
    console.log("  registered domains:");
    for (const d of data) {
      const wallets = [
        d.apple_pay?.status === "active" ? "Apple Pay" : null,
        d.google_pay?.status === "active" ? "Google Pay" : null,
        d.link?.status === "active" ? "Link" : null,
        d.paypal?.status === "active" ? "PayPal" : null,
      ].filter(Boolean);
      console.log(
        `    ${d.domain_name}  ${d.enabled ? "enabled" : "DISABLED"}` +
          `  [${wallets.join(", ") || "none active"}]`,
      );
    }
    console.log();
  }
  process.exit(0);
}

if (domain.includes("localhost") || domain.includes("127.0.0.1")) {
  console.error(
    "\n  localhost cannot be registered with Stripe.\n" +
      "  Wallets only appear on a real domain — test them on the deployed site.\n",
  );
  process.exit(1);
}

const created = await stripe.paymentMethodDomains.create({
  domain_name: domain,
});

console.log(`  registered ${created.domain_name} (${created.id})`);
for (const [name, state] of [
  ["Apple Pay", created.apple_pay],
  ["Google Pay", created.google_pay],
  ["Link", created.link],
  ["PayPal", created.paypal],
]) {
  const status = state?.status ?? "unknown";
  const why = state?.status_details?.error_message;
  console.log(`    ${name.padEnd(11)} ${status}${why ? ` — ${why}` : ""}`);
}
console.log();
