import { blobStore } from "@/lib/blob-store";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { getPrisma } from "@/lib/prisma";
import { settleSession } from "@/lib/checkout";
import { getDownloadAsset } from "@/lib/releases";
import { isPlatform } from "@/lib/platforms";
import { badRequest } from "@/lib/api-auth";

/**
 * Hands over the download after a paid checkout.
 *
 * Called by the page Stripe redirects back to. It deliberately does not wait
 * for the webhook: webhook delivery can lag by seconds, and someone who has
 * just paid should not be watching a spinner while two Stripe systems catch up
 * with each other. This asks Stripe directly.
 *
 * Both paths then converge on `markPaid`, which only ever moves `pending` to
 * `paid`, so whichever arrives first wins and the second is a no-op.
 *
 * No session required. The Checkout Session id is the capability: it is
 * unguessable, it is only handed to the person who completed that payment, and
 * it is checked against Stripe on every call. Requiring a login here would
 * strand every guest who just paid.
 */
export async function POST(request: Request) {
  if (!stripeEnabled()) {
    return Response.json(
      { error: "Card payments are not switched on." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const { sessionId } = (body ?? {}) as { sessionId?: unknown };
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return badRequest("A checkout session id is required");
  }

  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    // Covers a made-up id and one from a different account alike.
    return Response.json({ error: "Unknown checkout session" }, { status: 404 });
  }

  if (session.payment_status !== "paid") {
    return Response.json(
      { error: "That payment has not completed.", status: session.payment_status },
      { status: 402 },
    );
  }

  const outcome = await settleSession(session);
  if (outcome === "recovered") {
    console.warn(`[fulfil] ${session.id} had no Purchase row — recovered`);
  }

  // The platform comes from the session metadata, not the request: it is what
  // was paid for, and taking it from the caller would let someone pay for one
  // platform and collect a different build.
  const platform = session.metadata?.platform;
  if (typeof platform !== "string" || !isPlatform(platform)) {
    console.error(`[fulfil] ${session.id} has no usable platform metadata`);
    return Response.json(
      { error: "Could not work out what was purchased." },
      { status: 500 },
    );
  }

  const asset = await getDownloadAsset(platform);
  if (!asset) {
    // Paid, but the release went away underneath them. Say so plainly rather
    // than a generic error — this one needs a human.
    return Response.json(
      {
        error:
          "Your payment went through, but that build is no longer available. " +
          "Email angie@scamp.club and we will sort it out.",
      },
      { status: 409 },
    );
  }

  const downloadUrl = await blobStore.presignGet(asset.key, asset.filename);

  // Purely informational — the amount is read back from our own row rather than
  // the session, so what is shown is what was recorded.
  const purchase = await getPrisma().purchase.findFirst({
    where: { stripeSessionId: session.id },
    select: { amountCents: true },
  });

  return Response.json({
    downloadUrl,
    filename: asset.filename,
    version: asset.version,
    amountCents: purchase?.amountCents ?? null,
    // So the thank-you page can offer an account without asking for the address
    // a second time. It comes from the session, not the caller.
    email: session.metadata?.email ?? session.customer_details?.email ?? null,
    hasAccount: Boolean(session.metadata?.userId),
  });
}
