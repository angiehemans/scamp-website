import { isPlatform } from "@/lib/platforms";
import { recordFreeClaim } from "@/lib/purchases";
import { checkAmount } from "@/lib/purchase-status";
import { badRequest, currentApiUser, unauthorized } from "@/lib/api-auth";

/**
 * Records "I'll take it for free" and points at the download.
 *
 * ── Why this refuses any non-zero amount ────────────────────────────────────
 * This endpoint writes a Purchase row without money changing hands. If it
 * accepted the amount from the request body, anyone with a session could POST
 * `{ amountCents: 50000 }` and add $500 to the revenue figures on /admin
 * without paying a cent. The numbers would then be worse than useless — they
 * would look authoritative and be wrong.
 *
 * So: zero only. A paid amount is corroborated by Stripe telling us money
 * arrived, never by the client asserting it. lib/purchases.ts hard-codes the 0
 * as a second line of defence.
 *
 * The response carries a download path rather than redirecting, because this is
 * called with fetch() from the form — a 302 here would be followed by the fetch
 * and the file downloaded into a JS variable rather than by the browser.
 */
export async function POST(request: Request) {
  const user = await currentApiUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const { platform, amountCents } = (body ?? {}) as {
    platform?: unknown;
    amountCents?: unknown;
  };

  if (typeof platform !== "string" || !isPlatform(platform)) {
    return badRequest("Unknown platform");
  }

  // Validate before the zero check so a malformed amount gets a useful message
  // rather than the generic refusal below.
  const check = checkAmount(amountCents);
  if (!check.ok) return badRequest(check.error!);

  if (amountCents !== 0) {
    return badRequest(
      "This endpoint only records free downloads. Paid amounts go through Stripe.",
    );
  }

  await recordFreeClaim(user.id, platform);

  return Response.json({ downloadUrl: `/api/download/${platform}` });
}
