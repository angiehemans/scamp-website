import { stripeEnabled, stripeIsTestMode, publishableKey } from "@/lib/stripe";

/**
 * Whether payments can be taken, and the key to talk to Stripe with.
 *
 * ── Why this is an endpoint and not a prop ──────────────────────────────────
 * /download is a static page in the marketing group. Anything it reads from
 * `process.env` at render time is evaluated at BUILD time and baked into the
 * HTML — so on Cloudflare, where STRIPE_SECRET_KEY is a Worker secret that does
 * not exist during the build, the page would always be built believing payments
 * are off.
 *
 * The same trap as `NEXT_PUBLIC_*`, and the reason lib/site.ts warns about it.
 * Fetching at runtime keeps the page static and the answer correct.
 *
 * The publishable key is meant to be public — that is the distinction between
 * it and the secret key — so serving it here is not a leak.
 */
export async function GET() {
  return Response.json(
    {
      canPay: stripeEnabled() && Boolean(publishableKey()),
      testMode: stripeIsTestMode(),
      publishableKey: publishableKey(),
    },
    {
      // Short cache: it changes only on redeploy, but a stale "payments are
      // off" would silently cost money.
      headers: { "Cache-Control": "public, max-age=60" },
    },
  );
}
