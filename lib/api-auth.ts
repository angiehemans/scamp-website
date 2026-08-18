import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { User } from "@/lib/generated/prisma/client";

/**
 * Resolves the caller for an API route, or null.
 *
 * Session-cookie based for now. The Electron client will eventually send a
 * bearer token instead — Better Auth has a plugin for that, and it plugs in
 * here rather than at every call site.
 */
export async function currentApiUser(): Promise<User | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
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
 * Sync is a Pro feature, but Stripe is not built yet and the plan is to test
 * locally first (Decision H in plans/cloud-backup.md). Everything routes
 * through here so switching it on is one function body rather than an audit of
 * every route.
 */
export function assertCanSync(_user: User): boolean {
  return true;
}

export function paymentRequired() {
  return Response.json(
    { error: "Cloud sync requires a Pro subscription" },
    { status: 402 },
  );
}
