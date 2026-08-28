import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import {
  createAuthorization,
  isAllowedRedirect,
  pruneExpired,
} from "@/lib/desktop-auth";
import { badRequest, unauthorized } from "@/lib/api-auth";

/**
 * Approves a desktop sign-in for the person currently signed in here.
 *
 * Called by the sign-in page *after* authentication, from the browser, with the
 * session cookie. It does not authenticate anyone — it converts an existing
 * browser session into a code the desktop app can redeem.
 *
 * Returns the callback URL rather than redirecting: the caller is fetch(), and
 * a 302 to `scamp://` would be followed by fetch rather than handed to the OS.
 */

/** base64url SHA-256 is always 43 characters. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const { redirectUri, state, codeChallenge, codeChallengeMethod } = (body ??
    {}) as Record<string, unknown>;

  // Exact allowlist. Anything looser makes this an open redirect that hands
  // out auth codes.
  if (typeof redirectUri !== "string" || !isAllowedRedirect(redirectUri)) {
    return badRequest("redirect_uri is not allowed");
  }
  if (typeof state !== "string" || state.length < 8 || state.length > 256) {
    return badRequest("state must be 8-256 characters");
  }
  // S256 only. Accepting "plain" would let a caller opt out of the very
  // protection this flow exists for, and an interceptor could then replay the
  // challenge as the verifier.
  if (codeChallengeMethod !== undefined && codeChallengeMethod !== "S256") {
    return badRequest("code_challenge_method must be S256");
  }
  if (typeof codeChallenge !== "string" || !CHALLENGE.test(codeChallenge)) {
    return badRequest("code_challenge must be base64url SHA-256");
  }

  // Minted from this browser session, stored, and released only against a
  // valid verifier. This is the thing that actually becomes a session.
  const ott = await getAuth().api.generateOneTimeToken({
    headers: await headers(),
  });
  if (!ott?.token) {
    return Response.json(
      { error: "Could not create a sign-in token." },
      { status: 500 },
    );
  }

  const { callbackUrl } = await createAuthorization({
    userId: session.user.id,
    codeChallenge,
    state,
    redirectUri,
    oneTimeToken: ott.token,
  });

  // Cheap, and keeps the table from accumulating abandoned sign-ins.
  void pruneExpired().catch(() => {});

  return Response.json({ callbackUrl });
}
