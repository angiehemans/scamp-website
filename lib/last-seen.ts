import { getPrisma } from "@/lib/prisma";
import type { User } from "@/lib/generated/prisma/client";

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
 * Never awaited by callers on the response path: activity tracking must not be
 * able to fail or slow down a request. Errors are swallowed on purpose.
 *
 * Mutates the passed user so the caller sees the fresh value without a reread.
 */
export function touchLastSeen(user: User, via: SeenVia): void {
  const field = via === "app" ? "lastSeenAppAt" : "lastSeenAt";
  const current = user[field];

  const stale =
    !current || Date.now() - current.getTime() > LAST_SEEN_THROTTLE_MS;
  if (!stale) return;

  const now = new Date();
  void getPrisma()
    .user.update({ where: { id: user.id }, data: { [field]: now } })
    .catch(() => {});
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
