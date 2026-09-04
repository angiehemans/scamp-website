import { isAdmin } from "@/lib/admin";
import { setCloudEnabled } from "@/lib/cloud";
import {
  badRequest,
  currentApiUser,
  notFound,
  unauthorized,
} from "@/lib/api-auth";

/**
 * Switches Scamp Cloud on or off for the caller's own account.
 *
 * Admin only, and only ever for *yourself*. There is no billing yet, and the
 * operator needs to use cloud backup without a payment plan that does not
 * exist. Everyone else waits for Stripe, which will write the same column
 * (see lib/cloud.ts) — this route is the bridge until then, not the design.
 *
 * A non-admin gets a 404, not a 403, for the same reason /admin does: a 403
 * confirms there is something here worth having.
 *
 * Body: `{ "enabled": true | false }`. Anything else is a 400 rather than
 * being coerced — `"enabled": "false"` must not switch cloud on.
 */
export async function POST(request: Request) {
  const user = await currentApiUser();
  if (!user) return unauthorized();
  if (!isAdmin(user)) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const enabled = (body as { enabled?: unknown })?.enabled;
  if (typeof enabled !== "boolean") {
    return badRequest("enabled must be true or false");
  }

  const since = await setCloudEnabled(user, enabled);
  return Response.json({
    cloud: { enabled: since !== null, since: since?.toISOString() ?? null },
  });
}
