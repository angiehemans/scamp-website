import { currentApiUser, unauthorized } from "@/lib/api-auth";

/**
 * "The app is running." Called on launch and periodically while open.
 *
 * ── Why a heartbeat rather than relying on other API calls ──────────────────
 * Every authenticated call already records activity, so in principle this is
 * redundant. In practice it is not: until cloud sync ships the app talks to
 * this API at sign-in and then essentially never again. Someone using Scamp
 * every day for a month would show a single active day, and the DAU chart would
 * look broken while actually measuring the wrong event.
 *
 * The heartbeat measures the thing we mean: the app was open.
 *
 * All the work happens in currentApiUser(), which resolves the bearer token and
 * records the timestamp. There is deliberately nothing else here — no body, no
 * response payload, nothing for the app to parse or get wrong. It is also
 * cheap enough to call every few hours without thinking about it.
 *
 * Suggested cadence: once at launch, then every four hours while running. More
 * often buys nothing — the write is throttled to five minutes anyway.
 */
export async function POST() {
  const user = await currentApiUser();
  if (!user) return unauthorized();
  return new Response(null, { status: 204 });
}
