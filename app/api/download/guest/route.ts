import { createHash } from "node:crypto";
import { blobStore } from "@/lib/blob-store";
import { isPlatform } from "@/lib/platforms";
import { getDownloadAsset } from "@/lib/releases";
import {
  recordGuestClaim,
  guestClaimsRecently,
  GUEST_CLAIMS_PER_HOUR,
} from "@/lib/purchases";
import { checkAmount } from "@/lib/purchase-status";
import { badRequest } from "@/lib/api-auth";

/**
 * Download without an account — the marketing-page path. See §4.5 of
 * plans/paid-downloads.md.
 *
 * This is the one endpoint here with no session behind it, so it is worth being
 * explicit about what that does and does not mean:
 *
 * - **It cannot claim a payment.** Zero only, exactly like the signed-in claim.
 *   A public endpoint that could write a paid amount would make the revenue
 *   figures on /admin whatever a stranger typed.
 * - **It sends no email.** So it cannot be pointed at a third party's inbox.
 * - **It is rate limited per IP**, on a hash, to stop a script filling the
 *   table. Downloads cost nothing to serve (R2 egress is free), so the only
 *   abuse worth pricing in is junk rows.
 *
 * It returns the presigned URL directly rather than pointing at
 * /api/download/<platform>, which requires a session. Adding a guest branch
 * there would put "is this person allowed" in two places.
 */

/** Deliberately permissive: this is a lead, and a wrong address costs nothing. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashIp(request: Request): string | null {
  // cf-connecting-ip is set by Cloudflare and cannot be spoofed by the client.
  // Same reasoning as the Better Auth config; x-forwarded-for is client-supplied
  // and would let anyone mint a fresh identity per request.
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const { email, platform, amountCents } = (body ?? {}) as {
    email?: unknown;
    platform?: unknown;
    amountCents?: unknown;
  };

  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    return badRequest("A valid email address is required");
  }
  if (email.length > 320) {
    return badRequest("That email address is too long");
  }
  if (typeof platform !== "string" || !isPlatform(platform)) {
    return badRequest("Unknown platform");
  }

  const check = checkAmount(amountCents);
  if (!check.ok) return badRequest(check.error!);
  if (amountCents !== 0) {
    return badRequest(
      "This endpoint only records free downloads. Paid amounts go through Stripe.",
    );
  }

  const ipHash = hashIp(request);
  if (ipHash && (await guestClaimsRecently(ipHash)) >= GUEST_CLAIMS_PER_HOUR) {
    return Response.json(
      { error: "Too many downloads from this address. Try again later." },
      { status: 429 },
    );
  }

  const asset = await getDownloadAsset(platform);
  if (!asset) {
    return Response.json(
      { error: "No build is available for that platform yet." },
      { status: 404 },
    );
  }

  await recordGuestClaim(email, platform, ipHash);

  const downloadUrl = await blobStore.presignGet(asset.key, asset.filename);

  return Response.json({
    downloadUrl,
    filename: asset.filename,
    version: asset.version,
  });
}
