import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

/**
 * Reads the current session and returns the matching database row, or null.
 *
 * Server-only, and calling it opts the route into dynamic rendering because it
 * reads request headers. That is why it must only ever be called from
 * app/(app) — calling it from app/(marketing) would turn a statically
 * prerendered page into a per-request one.
 *
 * The Prisma row is returned rather than the session's embedded user because
 * that row is the thing `Project`, `Share`, and subscription state will join to
 * later. There is no separate identity provider to reconcile against: Better
 * Auth writes into this same table.
 */
/**
 * How stale `lastSeenAt` may get before it is rewritten.
 *
 * Without a throttle this would be a database write on every authenticated
 * request, including every RSC navigation. Five minutes is far finer than the
 * day/month buckets DAU and MAU actually need.
 */
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export async function getCurrentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return null;

  const stale =
    !user.lastSeenAt ||
    Date.now() - user.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS;

  if (stale) {
    const now = new Date();
    // Not awaited on the response path — activity tracking must never be able
    // to fail or slow down a page render. Errors are swallowed deliberately.
    void prisma.user
      .update({ where: { id: user.id }, data: { lastSeenAt: now } })
      .catch(() => {});
    user.lastSeenAt = now;
  }

  return user;
}
