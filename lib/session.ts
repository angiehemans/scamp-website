import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { touchLastSeen } from "@/lib/last-seen";

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
export async function getCurrentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return null;

  // Page routes are always the website. The desktop app never renders these.
  touchLastSeen(user, "web");

  return user;
}
