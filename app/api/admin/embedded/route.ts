import { isAdmin } from "@/lib/admin";
import { setEmbeddedEnabled } from "@/lib/features";
import { getPrisma } from "@/lib/prisma";
import {
  badRequest,
  currentApiUser,
  notFound,
  unauthorized,
} from "@/lib/api-auth";

/**
 * Switches Edit React Project on or off for another account, by email.
 * Admin only; a non-admin gets a 404, as /admin does.
 *
 * Body: `{ "email": string, "enabled": true | false }`. Anything else is a
 * 400 rather than being coerced. An unknown email is a 404 with a message,
 * since only admins can reach this and they need to know it didn't apply.
 */
export async function POST(request: Request) {
  const caller = await currentApiUser();
  if (!caller) return unauthorized();
  if (!isAdmin(caller)) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const { email, enabled } = (body ?? {}) as {
    email?: unknown;
    enabled?: unknown;
  };
  if (typeof email !== "string" || email.trim().length === 0) {
    return badRequest("email is required");
  }
  if (typeof enabled !== "boolean") {
    return badRequest("enabled must be true or false");
  }

  const user = await getPrisma().user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
  });
  if (!user) {
    return Response.json(
      { error: "No account uses that email." },
      { status: 404 },
    );
  }

  const since = await setEmbeddedEnabled(user, enabled);
  return Response.json({
    email: user.email,
    embedded: { enabled: since !== null, since: since?.toISOString() ?? null },
  });
}
