import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getPrisma } from "@/lib/prisma";

/**
 * Sign-in handoff from the browser to the desktop app.
 *
 * ── The threat this is shaped around ────────────────────────────────────────
 * The app registers `scamp://` and the browser hands the callback URL to the
 * OS, which routes it by scheme. On every desktop platform *any* installed
 * application can register a scheme, and on Windows and Linux the last one to
 * register generally wins. So the callback URL must be treated as readable by
 * software that is not ours.
 *
 * Everything else follows from that:
 *
 *  - the callback carries a `code`, never a session token
 *  - the code is worthless without the `verifier`, which never leaves the app
 *  - the code is single use and short lived
 *  - `state` is echoed back so the app can reject a callback it did not start
 *
 * This is PKCE (RFC 7636), which exists for precisely this attack. Echoing
 * `state` alone would leave the token exfiltratable by a malicious local app.
 */

/**
 * Callbacks the sign-in page may redirect to.
 *
 * An exact allowlist, never a prefix or wildcard match. Anything looser turns
 * the sign-in page into an open redirect that hands out auth codes, which is
 * the single worst bug this flow can have.
 *
 * Localhost is here for development: an Electron dev build can run a loopback
 * listener instead of registering a scheme, which is easier to iterate on.
 */
export const ALLOWED_REDIRECTS = [
  "scamp://auth/callback",
  "http://localhost:8976/callback",
  "http://127.0.0.1:8976/callback",
] as const;

export function isAllowedRedirect(uri: string): boolean {
  return (ALLOWED_REDIRECTS as readonly string[]).includes(uri);
}

/** Long enough to sign in unhurried, short enough that a stale code is stale. */
const CODE_TTL_MS = 10 * 60 * 1000;

/** Base64url, because these travel in URLs. */
const b64url = (b: Buffer) => b.toString("base64url");

export function challengeFor(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

export interface AuthorizeInput {
  userId: string;
  /** SHA-256 of the app's verifier, base64url. Never the verifier. */
  codeChallenge: string;
  state: string;
  redirectUri: string;
  /** Minted from the browser session; handed over only on a valid exchange. */
  oneTimeToken: string;
}

/** Records an approved sign-in and returns the code for the callback URL. */
export async function createAuthorization(
  input: AuthorizeInput,
): Promise<{ code: string; callbackUrl: string }> {
  if (!isAllowedRedirect(input.redirectUri)) {
    throw new Error(`redirect_uri not allowed: ${input.redirectUri}`);
  }

  const code = b64url(randomBytes(32));
  await getPrisma().desktopAuthRequest.create({
    data: {
      code,
      codeChallenge: input.codeChallenge,
      state: input.state,
      redirectUri: input.redirectUri,
      userId: input.userId,
      oneTimeToken: input.oneTimeToken,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  const url = new URL(input.redirectUri);
  url.searchParams.set("code", code);
  url.searchParams.set("state", input.state);

  return { code, callbackUrl: url.toString() };
}

export type ExchangeFailure =
  | "unknown_code"
  | "expired"
  | "already_used"
  | "bad_verifier";

export type ExchangeResult =
  | { ok: true; oneTimeToken: string; userId: string }
  | { ok: false; reason: ExchangeFailure };

/**
 * Trades a code plus its verifier for the stored one-time token.
 *
 * Marks the row consumed before returning, so a code cannot be redeemed twice.
 * If an interceptor redeems first, the real app's attempt fails visibly rather
 * than both quietly succeeding.
 */
export async function exchangeCode(
  code: string,
  verifier: string,
): Promise<ExchangeResult> {
  const prisma = getPrisma();
  const row = await prisma.desktopAuthRequest.findUnique({ where: { code } });

  if (!row) return { ok: false, reason: "unknown_code" };
  if (row.consumedAt) return { ok: false, reason: "already_used" };
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  // Constant-time, so a caller cannot narrow the challenge by timing repeated
  // guesses. Both sides are base64url of a fixed-length digest, so a length
  // mismatch already means "wrong" and comparing lengths first is safe.
  const expected = Buffer.from(row.codeChallenge, "utf8");
  const actual = Buffer.from(challengeFor(verifier), "utf8");
  const matches =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    // Burn the code. A wrong verifier means either a bug or someone trying
    // codes, and neither deserves a second attempt at the same one.
    await prisma.desktopAuthRequest.update({
      where: { code },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "bad_verifier" };
  }

  await prisma.desktopAuthRequest.update({
    where: { code },
    data: { consumedAt: new Date() },
  });

  return { ok: true, oneTimeToken: row.oneTimeToken, userId: row.userId };
}

/**
 * Removes expired and consumed rows.
 *
 * Called opportunistically rather than on a schedule: this table only grows
 * when someone signs in from the desktop app, so a sweep on each authorize is
 * both frequent enough and free.
 */
export async function pruneExpired(): Promise<number> {
  const { count } = await getPrisma().desktopAuthRequest.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - CODE_TTL_MS) } },
  });
  return count;
}
