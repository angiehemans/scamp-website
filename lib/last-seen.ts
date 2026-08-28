import { getPrisma } from "@/lib/prisma";
import type { User } from "@/lib/generated/prisma/client";
import { afterResponse } from "@/lib/after-response";

/**
 * Activity tracking, shared by the web session and the API.
 *
 * Two columns, deliberately:
 *
 *   lastSeenAt      someone visited this website while signed in
 *   lastSeenAppAt   the desktop app reported in
 *
 * They answer different questions. "How many people opened the site" is not
 * "how many people used Scamp", and until now the admin page could only report
 * the first while carrying a paragraph apologising for it. One merged column
 * could never be split later, because the history to split would not exist.
 *
 * A request that arrives with a bearer token is treated as the app; a cookie is
 * the website. That is not a guarantee — a script can send a bearer token — but
 * it is the honest reading of the only signal available, and nothing depends on
 * it being unforgeable.
 */

/**
 * How stale a timestamp may get before it is rewritten.
 *
 * Without a throttle this is a database write on every authenticated request,
 * including every RSC navigation. Five minutes is far finer than the day and
 * month buckets DAU and MAU actually need.
 */
export const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export type SeenVia = "web" | "app";

/**
 * Records activity, at most once per throttle window.
 *
 * ── Why this is awaited, and why the await is cheap ─────────────────────────
 * This was a floating promise: fire the update, do not wait, keep the request
 * fast. That works in Node, where the process outlives the response, and is
 * silently WRONG on Workers — the response returns, the request context is
 * torn down, and a write that had not finished is simply lost. Activity landed
 * intermittently in production while passing every local test.
 *
 * Awaiting `afterResponse` waits only for the write to be *registered* with
 * `ctx.waitUntil`, not for it to finish. The request still returns without
 * paying for a database round trip; the write is just guaranteed to survive.
 *
 * Errors are still swallowed. Activity tracking must never be able to fail a
 * request.
 *
 * Mutates the passed user so the caller sees the fresh value without a reread.
 */
export async function touchLastSeen(user: User, via: SeenVia): Promise<void> {
  const field = via === "app" ? "lastSeenAppAt" : "lastSeenAt";
  const current = user[field];

  const stale =
    !current || Date.now() - current.getTime() > LAST_SEEN_THROTTLE_MS;
  if (!stale) return;

  const now = new Date();
  await afterResponse(
    getPrisma().user.update({
      where: { id: user.id },
      data: { [field]: now },
    }),
  );
  user[field] = now;
}

/**
 * Which client a request came from.
 *
 * A bearer token means the desktop app: the web pages authenticate with a
 * cookie and never set this header. See api-docs/desktop-auth.md.
 */
export function seenVia(headers: Headers): SeenVia {
  return headers.get("authorization")?.startsWith("Bearer ") ? "app" : "web";
}
