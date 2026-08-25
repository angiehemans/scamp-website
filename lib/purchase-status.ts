/**
 * Purchase states, and the money rules that go with them.
 *
 * Lives outside the Prisma schema because `@better-auth/cli generate` rewrites
 * that file and drops enum declarations it does not recognise — the same class
 * of problem that keeps eating `runtime = "workerd"`.
 */

export const PURCHASE_STATUS = {
  /** Chose to pay nothing. A real, recorded decision — not an absent row. */
  FREE: "free",
  /** A Stripe Checkout session exists but has not completed. */
  PENDING: "pending",
  /** Money actually arrived. Only the webhook may write this. */
  PAID: "paid",
  REFUNDED: "refunded",
} as const;

export type PurchaseStatus =
  (typeof PURCHASE_STATUS)[keyof typeof PURCHASE_STATUS];

/** Statuses that count toward revenue. */
export const REVENUE_STATUSES: PurchaseStatus[] = [PURCHASE_STATUS.PAID];

/**
 * What a paid Checkout session may be for, in cents.
 *
 * The floor is not arbitrary: card networks make sub-$0.50 charges pointless
 * once fees are taken, so anything under a dollar goes down the free path
 * instead of creating a charge that costs more to process than it collects.
 *
 * The ceiling is a typo guard. Someone meaning $50 who types 5000 into a
 * dollars field should not be charged $5,000.
 */
export const MIN_PAID_CENTS = 100;
export const MAX_PAID_CENTS = 50_000;

/** Amounts offered as one-tap choices. Dollars, ascending, $0 first. */
export const SUGGESTED_AMOUNTS = [0, 10, 25] as const;

export interface AmountCheck {
  ok: boolean;
  error?: string;
}

/**
 * Validates a client-supplied amount.
 *
 * Every caller must run this. The amount arrives as JSON from a browser, so
 * "the form only offers sensible values" is not a constraint on what actually
 * gets posted.
 */
export function checkAmount(value: unknown): AmountCheck {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: "amountCents must be a number" };
  }
  if (!Number.isInteger(value)) {
    // Cents are indivisible. A fractional value means the client did dollar
    // arithmetic in floating point, and the total will not reconcile.
    return { ok: false, error: "amountCents must be a whole number of cents" };
  }
  if (value < 0) {
    return { ok: false, error: "amountCents cannot be negative" };
  }
  if (value > 0 && value < MIN_PAID_CENTS) {
    return { ok: false, error: `paid amounts start at ${MIN_PAID_CENTS} cents` };
  }
  if (value > MAX_PAID_CENTS) {
    return { ok: false, error: `amountCents cannot exceed ${MAX_PAID_CENTS}` };
  }
  return { ok: true };
}
