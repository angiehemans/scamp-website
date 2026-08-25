import Stripe from "stripe";

/**
 * Stripe, configured for Cloudflare Workers.
 *
 * Three things here are not optional on workerd, and all three fail only at
 * runtime — they compile, they pass locally on Node, and they break in
 * production. Same class of bug as the Prisma Wasm compiler and the Neon HTTP
 * adapter earlier in this project.
 *
 * 1. `createFetchHttpClient()`. stripe-node defaults to `node:https`, which
 *    Workers do not implement.
 * 2. Built per request, never at module scope. A cached client pins one
 *    request's I/O context for the isolate's lifetime, which is what produced
 *    `Cannot perform I/O on behalf of a different request`. Same rule as
 *    getPrisma() and getAuth().
 * 3. Webhook verification must use `constructEventAsync` with
 *    `createSubtleCryptoProvider()` — see lib/stripe-webhook.ts. The
 *    synchronous `constructEvent` throws "SubtleCryptoProvider cannot be used
 *    in a synchronous context".
 */

const isWorkers =
  (typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers") ||
  typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !==
    "undefined";

let cached: Stripe | null = null;

export function requireStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Payments are disabled — see " +
        "api-docs/deployment.md.",
    );
  }
  return key;
}

/** True when payments can be taken at all. The UI asks before offering to charge. */
export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** True when the configured key is a test key. Surfaced in the UI so nobody
 *  believes a test payment was real. */
export function stripeIsTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

function build(): Stripe {
  return new Stripe(requireStripeKey(), {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function getStripe(): Stripe {
  if (isWorkers) return build();
  if (!cached) cached = build();
  return cached;
}

/**
 * Stripe product tax code for the desktop app.
 *
 * "Downloadable Software - non-recreational - personal use". Scamp is a
 * professional design tool bought by individuals, downloaded rather than hosted
 * — which is why this rather than a SaaS code. The personal/business split only
 * affects US sales.
 *
 * CONFIRM THIS WITH AN ACCOUNTANT before taking live payments. It decides what
 * rate is charged in every jurisdiction, and getting it wrong is a filing
 * problem rather than a bug that shows up in a test.
 */
export const TAX_CODE = "txcd_10202001";

/**
 * Tax is taken out of the amount, not added on top.
 *
 * `inclusive` because the whole promise is "pay what you want": someone who
 * picks $25 is charged $25, and the VAT comes out of it. With `exclusive` the
 * total would vary by country after they had already chosen a number, which
 * makes the choice a lie.
 *
 * The trade-off is that revenue per sale varies by where the buyer lives. For
 * an optional contribution that is the right way round.
 */
export const TAX_BEHAVIOR = "inclusive" as const;
