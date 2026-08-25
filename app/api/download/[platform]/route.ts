import { blobStore } from "@/lib/blob-store";
import { isPlatform } from "@/lib/platforms";
import { getDownloadAsset } from "@/lib/releases";
import { currentApiUser, notFound, unauthorized } from "@/lib/api-auth";

/**
 * Hands out the installer for a platform.
 *
 * **The only check is that you are signed in.** Paying is optional and buys
 * nothing extra (see plans/paid-downloads.md), so there is deliberately no
 * entitlement lookup here — no `Purchase` read, no licence check, no
 * "did they pay" branch. If a future change adds one, that is a product
 * decision, not a tidy-up.
 *
 * Responds with a 302 to a short-lived presigned URL rather than streaming the
 * bytes. A ~100 MB installer proxied through the Worker would burn CPU time and
 * memory on every download for no benefit; R2 serves it directly, with free
 * egress and working range requests (which is what makes the download
 * resumable).
 *
 * The R2 key never reaches the client. The bucket layout stays private and the
 * link expires, so a URL pasted into a group chat stops working.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const user = await currentApiUser();
  if (!user) return unauthorized();

  const { platform } = await params;
  if (!isPlatform(platform)) return notFound();

  const asset = await getDownloadAsset(platform);
  // Covers "no release", "nothing published yet", and "no build for this
  // platform" identically — the caller can do nothing different about any of
  // them.
  if (!asset) return notFound();

  const url = await blobStore.presignGet(asset.key, asset.filename);

  return Response.redirect(url, 302);
}
