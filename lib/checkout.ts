import type Stripe from "stripe";
import { getPrisma } from "@/lib/prisma";
import { getStripe, TAX_CODE, TAX_BEHAVIOR } from "@/lib/stripe";
import { PURCHASE_STATUS } from "@/lib/purchase-status";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { platformLabel } from "@/lib/platforms";

/**
 * Creating and settling a pay-what-you-want checkout.
 *
 * Works for both a signed-in user and a guest with only an email address, so
 * the marketing page and the dashboard share one path. The difference is
 * whether there is a `userId` to attach.
 */

export interface CheckoutInput {
  amountCents: number;
  platform: string;
  /** Present when signed in. */
  userId: string | null;
  email: string;
}

/**
 * Reuses this account's Stripe Customer, or makes one.
 *
 * Guests get no Customer: they have not agreed to anything ongoing, and a
 * Customer per anonymous download would fill the dashboard with records that
 * can never be reconciled to a person. Checkout still collects their email.
 */
async function customerFor(
  stripe: Stripe,
  userId: string | null,
  email: string,
): Promise<string | undefined> {
  if (!userId) return undefined;

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, name: true },
  });
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    name: user?.name ?? undefined,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

export interface CheckoutResult {
  url: string;
  purchaseId: string;
}

export async function createCheckout({
  amountCents,
  platform,
  userId,
  email,
}: CheckoutInput): Promise<CheckoutResult> {
  const stripe = getStripe();
  const prisma = getPrisma();

  const customer = await customerFor(stripe, userId, email);

  // Where Stripe sends them back. Derived server-side from whether they are
  // signed in — never taken from the request, which would be an open redirect.
  const base = SITE_URL;
  const returnPath = userId ? "/dashboard" : "/download";

  // Recorded as pending *before* the session exists would leave a row with no
  // session id if creation failed, so the session comes first and the row
  // carries its id from the start.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    customer_email: customer ? undefined : email,
    // Needed for Stripe Tax: the rate comes from where the buyer is, and with
    // no shipping address that means the billing address.
    billing_address_collection: "required",
    automatic_tax: { enabled: true },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          tax_behavior: TAX_BEHAVIOR,
          product_data: {
            name: `${SITE_NAME} for ${platformLabel(platform)}`,
            description: "Pay what you want. Thank you for supporting Scamp.",
            tax_code: TAX_CODE,
          },
        },
      },
    ],
    // Everything the webhook needs to settle this without a second lookup.
    metadata: {
      platform,
      userId: userId ?? "",
      email,
    },
    success_url: `${base}${returnPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${returnPath}?checkout=cancelled`,
  });

  const purchase = await prisma.purchase.create({
    data: {
      userId,
      email: email.trim().toLowerCase(),
      amountCents,
      platform,
      status: PURCHASE_STATUS.PENDING,
      stripeSessionId: session.id,
    },
  });

  if (!session.url) {
    throw new Error("Stripe returned a session with no URL");
  }

  return { url: session.url, purchaseId: purchase.id };
}

/**
 * Marks a checkout paid, exactly once.
 *
 * Called from two places that race: the webhook, and the browser coming back to
 * the success URL. Both are needed — the webhook is the only reliable signal
 * (the browser may never return), and the return is the only *fast* one (the
 * webhook can lag). So this has to be safe to run twice.
 *
 * Idempotent by only ever moving `pending` to `paid`: a second call updates
 * nothing because the row no longer matches.
 */
export async function markPaid(
  sessionId: string,
  paymentIntentId: string | null,
): Promise<boolean> {
  const { count } = await getPrisma().purchase.updateMany({
    where: { stripeSessionId: sessionId, status: PURCHASE_STATUS.PENDING },
    data: {
      status: PURCHASE_STATUS.PAID,
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntentId,
    },
  });
  return count > 0;
}
