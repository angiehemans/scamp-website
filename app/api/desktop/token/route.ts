import { getAuth } from "@/lib/auth";
import { exchangeCode } from "@/lib/desktop-auth";
import { badRequest } from "@/lib/api-auth";

/**
 * Trades an auth code plus its verifier for a session the desktop app can use.
 *
 * Deliberately unauthenticated: the app has no session yet, which is the whole
 * point. The code and the verifier together *are* the credential, and the
 * verifier is what an interceptor of the callback URL does not have.
 *
 * The response is the session token. The app stores it (safeStorage) and sends
 * it as `Authorization: Bearer <token>` — the bearer plugin makes every
 * existing API route accept it with no change at the call sites.
 */

/** RFC 7636 puts the verifier between 43 and 128 characters. */
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const { code, codeVerifier } = (body ?? {}) as Record<string, unknown>;

  if (typeof code !== "string" || code.length === 0) {
    return badRequest("code is required");
  }
  if (typeof codeVerifier !== "string" || !VERIFIER.test(codeVerifier)) {
    return badRequest("code_verifier must be 43-128 unreserved characters");
  }

  const result = await exchangeCode(code, codeVerifier);

  if (!result.ok) {
    // One shape for every failure. Distinguishing "unknown code" from "wrong
    // verifier" would tell someone working through stolen codes which half
    // they got right.
    console.warn(`[desktop-auth] exchange refused: ${result.reason}`);
    return Response.json(
      { error: "That sign-in code is not valid." },
      { status: 400 },
    );
  }

  // Redeeming the one-time token is what actually creates the session. Done
  // here rather than in the app so the app never handles two tokens, and so a
  // token that leaks from our table is still single-use.
  const verified = await getAuth().api.verifyOneTimeToken({
    body: { token: result.oneTimeToken },
  });

  const token = (verified as { session?: { token?: string } })?.session?.token;
  if (!token) {
    console.error("[desktop-auth] one-time token did not yield a session");
    return Response.json(
      { error: "Could not complete sign-in." },
      { status: 500 },
    );
  }

  const user = (verified as { user?: Record<string, unknown> }).user;

  return Response.json({
    token,
    // Returned so the app can show who is signed in without a second call.
    // Not a substitute for the server checking on every request.
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
        }
      : null,
  });
}
