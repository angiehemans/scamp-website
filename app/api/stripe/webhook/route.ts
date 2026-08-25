import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getPrisma } from "@/lib/prisma";
import { markPaid } from "@/lib/checkout";
import { PURCHASE_STATUS } from "@/lib/purchase-status";

/**
 * Stripe webhook. The authoritative record of whether money arrived.
 *
 * ── Why this exists when the browser already comes back ─────────────────────
 * `success_url` is a redirect the customer may never follow — they can close
 * the tab the instant the payment clears. Treating that redirect as the record
 * of payment loses real revenue. The redirect updates the UI; this decides the
 * truth.
 *
 * ── Three things that only break on Workers ─────────────────────────────────
 * 1. `constructEventAsync`, not `constructEvent`. WebCrypto is async, so the
 *    synchronous version throws "SubtleCryptoProvider cannot be used in a
 *    synchronous context".
 * 2. The RAW body. Signature verification is over the exact bytes Stripe sent,
 *    so `request.text()` and nothing before it. Reading the body twice throws
 *    "Body has already been used".
 * 3. No session. Stripe has no cookie; the signature IS the authentication,
 *    which is why a missing or unverifiable one is a hard 400 rather than
 *    something to work around.
 *
 * ── Answer fast ─────────────────────────────────────────────────────────────
 * Stripe retries on any non-2xx and on timeouts. Record the event, do the one
 * small write, return. Anything slow belongs elsewhere.
 */

function requireWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return secret;
}

/**
 * Records the event id, or reports that it has been seen.
 *
 * The insert *is* the check. Asking "have we seen this?" and then writing it
 * would leave a window where two concurrent deliveries both see nothing and
 * both process — and Stripe does deliver concurrently. Letting the primary key
 * reject the second one closes that window in the database rather than hoping.
 */
async function firstTimeSeeing(id: string, type: string): Promise<boolean> {
  try {
    await getPrisma().stripeEvent.create({ data: { id, type } });
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      raw,
      signature,
      requireWebhookSecret(),
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    // Deliberately terse to the caller. A detailed reason would help someone
    // probing the endpoint refine a forgery.
    console.error("[stripe] signature verification failed:", error);
    return new Response("Invalid signature", { status: 400 });
  }

  if (!(await firstTimeSeeing(event.id, event.type))) {
    // Already handled. 200 so Stripe stops retrying.
    return Response.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // `completed` fires for unpaid sessions too (async payment methods), so
        // the payment status is what matters, not the event name.
        if (session.payment_status === "paid") {
          const changed = await markPaid(
            session.id,
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
          );
          console.log(
            `[stripe] ${session.id} paid${changed ? "" : " (already recorded)"}`,
          );
        }
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaid(
          session.id,
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        );
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const intent =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : null;
        if (intent) {
          await getPrisma().purchase.updateMany({
            where: { stripePaymentIntentId: intent },
            data: { status: PURCHASE_STATUS.REFUNDED },
          });
        }
        break;
      }

      default:
        // Everything else is acknowledged and ignored. Returning non-2xx for an
        // event we simply do not handle would make Stripe retry it forever.
        break;
    }
  } catch (error) {
    // The event id is already recorded, so a retry would be dropped as a
    // duplicate and the write would be lost. Remove it so the retry is real.
    console.error(`[stripe] handling ${event.type} failed:`, error);
    await getPrisma()
      .stripeEvent.delete({ where: { id: event.id } })
      .catch(() => {});
    return new Response("Handler failed", { status: 500 });
  }

  return Response.json({ received: true });
}
