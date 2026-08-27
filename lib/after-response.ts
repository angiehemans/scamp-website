import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Runs work that should not delay the response.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The sign-up notification simply `await`s the Resend call, which is correct
 * but costs the user a round trip. That is tolerable once, at sign-up. It is
 * not tolerable on every download, where the response carries the URL the
 * browser is waiting to fetch — a few hundred milliseconds of email latency
 * would be several hundred milliseconds before the file starts.
 *
 * A floating promise is the obvious fix and is WRONG on Workers: the request
 * context is torn down once the response is returned, and anything still using
 * it throws "Cannot perform I/O on behalf of a different request". That is the
 * same failure that forced getPrisma() and getAuth() to be per-request.
 *
 * `ctx.waitUntil` is the supported way to say "keep this request alive until
 * this promise settles, but send the response now".
 *
 * Falls back to awaiting in Node (local dev, checkpoint scripts), where there
 * is no execution context and nothing to tear down. So behaviour is identical
 * either way — only the timing differs.
 */
export async function afterResponse(work: Promise<unknown>): Promise<void> {
  // Never let background work surface as a request failure. Callers use this
  // for things that are nice to have, not things the response depends on.
  const guarded = work.catch((error) => {
    console.error("[after-response] background work failed:", error);
  });

  try {
    const { ctx } = await getCloudflareContext({ async: true });
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(guarded);
      return;
    }
  } catch {
    // No Cloudflare context — Node, or a script. Fall through and await.
  }

  await guarded;
}
