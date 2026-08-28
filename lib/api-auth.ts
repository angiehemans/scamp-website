import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { touchLastSeen, seenVia } from "@/lib/last-seen";
import type { User } from "@/lib/generated/prisma/client";

/**
 * Resolves the caller for an API route, or null.
 *
 * Accepts a session cookie or `Authorization: Bearer <token>` — the bearer
 * plugin in lib/auth.ts handles both at getSession(), so this needed no change
 * when the desktop app arrived.
 *
 * Records activity as a side effect, tagged by which client called. Until this
 * existed the desktop app was invisible to DAU and MAU: only page routes wrote
 * a timestamp, and the app never renders a page.
 */
export async function currentApiUser(): Promise<User | null> {
  const h = await headers();
  const session = await getAuth().api.getSession({ headers: h });
  if (!session) return null;

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return null;

  await touchLastSeen(user, seenVia(h));
  return user;
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Deliberately 404, never 403, when a resource belongs to someone else.
 * A 403 would confirm the id exists, which leaks whether a given project is
 * real. Callers should not distinguish "absent" from "not yours".
 */
export function notFound() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

/**
 * The single gate for cloud sync access.
 *
 * Two separate concerns, deliberately kept apart so the API can say *why*
 * access was refused rather than returning one opaque error:
 *
 *   - entitlement — Pro subscription. Not enforced yet; Stripe is not built.
 *   - verification — a confirmed email address. Enforced now.
 *
 * Unverified accounts can sign in and see the dashboard; what they cannot do is
 * put data in the cloud. That keeps the sign-up path frictionless while making
 * an unconfirmed address useless for consuming storage.
 */
export type SyncDenial = "unverified" | "no-subscription" | null;

export function checkCanSync(user: User): SyncDenial {
  if (!user.emailVerified) return "unverified";
  // Entitlement check goes here once Stripe exists.
  return null;
}

export function syncDenied(reason: NonNullable<SyncDenial>) {
  if (reason === "unverified") {
    return Response.json(
      {
        error:
          "Verify your email address before using cloud backup. Check your inbox, or request a new link from your dashboard.",
        code: "EMAIL_NOT_VERIFIED",
      },
      { status: 403 },
    );
  }
  return Response.json(
    { error: "Cloud sync requires a Pro subscription", code: "PRO_REQUIRED" },
    { status: 402 },
  );
}
