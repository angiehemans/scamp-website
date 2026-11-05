import { isPlatform } from "@/lib/platforms";
import { getDownloadAsset } from "@/lib/releases";
import { createCheckout } from "@/lib/checkout";
import { checkAmount, MIN_PAID_CENTS } from "@/lib/purchase-status";
import { stripeEnabled } from "@/lib/stripe";
import { badRequest, currentApiUser } from "@/lib/api-auth";

/**
 * Starts a paid pay-what-you-want checkout.
 *
 * Serves both callers: a signed-in user from the dashboard, and a guest from
 * the marketing page who supplies an email. One route rather than two, because
 * the only real difference is whether there is a `userId` to attach — splitting
 * them would mean maintaining the amount rules in two places.
 *
 * Unlike the free claim endpoints, this one *may* accept a non-zero amount,
 * because nothing is recorded as revenue here. The row is written `pending` and
 * only becomes `paid` when Stripe says money moved. A caller can therefore lie
 * about the amount all they like and the only consequence is that Stripe asks
 * them to pay it.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!stripeEnabled()) {
    return Response.json(
      { error: "Card payments are not switched on yet." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const { platform, amountCents, email } = (body ?? {}) as {
    platform?: unknown;
    amountCents?: unknown;
    email?: unknown;
  };

  if (typeof platform !== "string" || !isPlatform(platform)) {
    return badRequest("Unknown platform");
  }

  const check = checkAmount(amountCents);
  if (!check.ok) return badRequest(check.error!);
  if ((amountCents as number) < MIN_PAID_CENTS) {
    // Below the floor there is nothing to charge. The free endpoints handle
    // that case, and routing it here would create a Stripe session for an
    // amount the card networks will not process.
    return badRequest(
      `Paid amounts start at ${MIN_PAID_CENTS} cents. Use the free download instead.`,
    );
  }

  const user = await currentApiUser();

  // A guest must tell us where to send the receipt. A signed-in user must not
  // be able to override their own address, or a receipt could be aimed at
  // someone else's inbox.
  const address = user?.email ?? (typeof email === "string" ? email.trim() : "");
  if (!EMAIL.test(address)) {
    return badRequest("A valid email address is required");
  }

  // Fail before taking money if there is nothing to hand over afterwards.
  const asset = await getDownloadAsset(platform);
  if (!asset) {
    return Response.json(
      { error: "No build is available for that platform yet." },
      { status: 404 },
    );
  }

  try {
    const { clientSecret, sessionId } = await createCheckout({
      amountCents: amountCents as number,
      platform,
      userId: user?.id ?? null,
      email: address,
    });

    // The download URL goes back with the checkout URL so the file can start
    // transferring *before* the browser leaves for Stripe.
    //
    // Nothing is being given away: the same build downloads for $0 anyway, so
    // withholding it until payment clears would add a wait for no gain and
    // punish the people choosing to pay. It also means an abandoned checkout
    // still leaves someone with the app they came for.
    const downloadUrl = asset.url;

    return Response.json({
      clientSecret,
      sessionId,
      downloadUrl,
      filename: asset.filename,
    });
  } catch (error) {
    console.error("[checkout] could not create session:", error);
    return Response.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 },
    );
  }
}
