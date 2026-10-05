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
 * Responds with a 302 to the installer on the update feed rather than
 * streaming the bytes. A ~100 MB installer proxied through the Worker would
 * burn CPU time and memory on every download for no benefit; the feed serves it
 * directly, with working range requests (which is what makes the download
 * resumable). See lib/releases.ts for why the feed is the source of truth.
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

  return Response.redirect(asset.url, 302);
}
