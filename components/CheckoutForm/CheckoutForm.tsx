"use client";

import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  PaymentElement,
  BillingAddressElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import styles from "./CheckoutForm.module.css";

/**
 * The payment form, rendered on our own page instead of Stripe's.
 *
 * Shared by the public /download page and the signed-in dashboard, which is why
 * it lives here rather than beside either of them.
 *
 * Uses Checkout Sessions in `ui_mode: "elements"` — the Elements render here,
 * but the Session still owns line items, tax and the total. That is the whole
 * point of this mode: `automatic_tax` keeps working, whereas Elements on a bare
 * PaymentIntent would mean computing VAT per jurisdiction ourselves and
 * recalculating it every time the address changes.
 *
 * The billing address element is not decoration — Stripe Tax picks the rate
 * from it, so removing it would silently break tax calculation.
 */

/** One Stripe.js load per key, not one per render. */
const stripeCache = new Map<string, Promise<Stripe | null>>();
function stripeFor(key: string): Promise<Stripe | null> {
  let p = stripeCache.get(key);
  if (!p) {
    p = loadStripe(key);
    stripeCache.set(key, p);
  }
  return p;
}

/**
 * Stripe's appearance API, pointed at the same values as the rest of the site.
 *
 * Hard-coded rather than read from CSS custom properties at runtime: the
 * Elements live in a cross-origin iframe and cannot see our stylesheet, so the
 * values have to be passed in. Kept next to a comment naming their source so a
 * theme change has one obvious place to follow.
 *
 * Mirrors app/globals.css:
 *   --color-bg-base #0a0a0a   --color-bg-surface #111111
 *   --color-text-primary #ededed   --color-text-secondary #888888
 *   --color-border-default #2e2e2e   --color-error #f85149
 */
const appearance = {
  theme: "night" as const,
  labels: "above" as const,
  inputs: "spaced" as const,
  variables: {
    colorPrimary: "#ededed",
    colorBackground: "#0a0a0a",
    colorText: "#ededed",
    colorTextSecondary: "#888888",
    colorTextPlaceholder: "#555555",
    colorDanger: "#f85149",
    // Real font names only. `var(--font-google-sans)` was here and silently
    // broke everything: the Elements run in a cross-origin iframe with no
    // access to our stylesheet, so the custom property never resolves, the
    // whole declaration is invalid, and the iframe falls back to its default —
    // which is a serif. Nothing errors; the form just looks wrong.
    fontFamily:
      '"Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSizeBase: "15px",
    spacingUnit: "4px",
    borderRadius: "8px",
    inputColorBorder: "#2e2e2e",
    inputFocusColorBorder: "#ededed",
    inputFocusBoxShadow: "none",
    labelColorText: "#ededed",
    labelFontWeight: "700",
    buttonColorBackground: "#ededed",
    buttonColorText: "#0a0a0a",
    buttonBorderRadius: "8px",
  },
};

/**
 * The webfont, loaded into Stripe's iframe.
 *
 * next/font self-hosts Google Sans under a build-hashed path that this iframe
 * cannot be told about, so the font is pulled from the Google Fonts CSS API
 * instead. Naming it in `fontFamily` alone is not enough — without this the
 * iframe has never heard of the family and falls through the stack.
 *
 * The weight range matches the 400-700 the site uses.
 */
const fonts = [
  {
    cssSrc:
      "https://fonts.googleapis.com/css2?family=Google+Sans:wght@400..700&display=swap",
  },
];

export interface CheckoutFormProps {
  clientSecret: string;
  publishableKey: string;
  filename: string | null;
  onCancel: () => void;
}

export default function CheckoutForm({
  clientSecret,
  publishableKey,
  filename,
  onCancel,
}: CheckoutFormProps) {
  return (
    <CheckoutElementsProvider
      stripe={stripeFor(publishableKey)}
      // `appearance` sits under elementsOptions for this provider. Passing it
      // at the top level type-errors — that shape belongs to the Form SDK.
      options={{ clientSecret, elementsOptions: { appearance, fonts } }}
    >
      <Inner filename={filename} onCancel={onCancel} />
    </CheckoutElementsProvider>
  );
}

function Inner({
  filename,
  onCancel,
}: {
  filename: string | null;
  onCancel: () => void;
}) {
  // A discriminated union, not a ready object: the SDK loads asynchronously, so
  // the session (and its total) does not exist on first render.
  const result = useCheckoutElements();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (result.type === "loading") {
    return <p className={styles.panelBody}>Loading payment form…</p>;
  }
  if (result.type === "error") {
    return (
      <>
        <p className={styles.error}>{result.error.message}</p>
        <p className={styles.skip}>
          <button type="button" className={styles.linkBtn} onClick={onCancel}>
            Skip payment
          </button>{" "}
          — you already have the download.
        </p>
      </>
    );
  }

  const checkout = result.checkout;

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const outcome = await checkout.confirm();

    // A redirect-based method (3D Secure, a bank app) navigates away and comes
    // back to return_url, so reaching here at all means it did not redirect.
    if (outcome.type === "error") {
      setError(outcome.error.message ?? "That payment could not be completed.");
      setPending(false);
    }
  }

  // The Session is the source of truth for the total, including tax — never a
  // number computed here, which would drift from what is actually charged.
  // `amount` is already formatted with the currency.
  const total = checkout.total?.total?.amount ?? null;

  return (
    <form className={styles.form} onSubmit={confirm}>
      {filename && (
        <div className={styles.downloadingNote}>
          <p className={styles.downloadingTitle}>Your download has started</p>
          <p className={styles.downloadingBody}>
            <strong>{filename}</strong> is on its way. Payment is optional and
            the file is already yours — closing this page will not stop it.
          </p>
        </div>
      )}

      <BillingAddressElement />
      <PaymentElement options={{ layout: "accordion" }} />

      {error && <p className={styles.error}>{error}</p>}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Paying…" : total ? `Pay ${total}` : "Pay"}
      </button>

      <p className={styles.skip}>
        <button type="button" className={styles.linkBtn} onClick={onCancel}>
          Skip payment
        </button>{" "}
        — you already have the download.
      </p>
    </form>
  );
}
