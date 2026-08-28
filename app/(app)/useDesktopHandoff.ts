"use client";

import { useEffect, useState } from "react";

/**
 * Carries a desktop sign-in through the web sign-in / sign-up pages.
 *
 * The desktop app opens the browser at:
 *
 *   /sign-in?desktop=1
 *           &redirect_uri=scamp://auth/callback
 *           &state=<opaque>
 *           &code_challenge=<base64url sha256 of the app's verifier>
 *
 * When authentication succeeds the page asks the server to mint a code, then
 * navigates to the callback URL, which the OS hands to the app.
 *
 * The parameters are read once on mount and held, because Better Auth replaces
 * the URL during sign-in and they would otherwise be gone by the time they are
 * needed.
 */

export interface DesktopHandoff {
  active: boolean;
  /** Sends the browser to the app's callback. Returns an error string, or null
   *  on success — in which case the page is already navigating away. */
  complete: () => Promise<string | null>;
}

export function useDesktopHandoff(): DesktopHandoff {
  const [params, setParams] = useState<{
    redirectUri: string;
    state: string;
    codeChallenge: string;
  } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("desktop") !== "1") return;

    const redirectUri = q.get("redirect_uri");
    const state = q.get("state");
    const codeChallenge = q.get("code_challenge");
    if (!redirectUri || !state || !codeChallenge) return;

    setParams({ redirectUri, state, codeChallenge });
  }, []);

  return {
    active: params !== null,
    async complete() {
      if (!params) return "No desktop sign-in in progress.";
      try {
        const res = await fetch("/api/desktop/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            redirectUri: params.redirectUri,
            state: params.state,
            codeChallenge: params.codeChallenge,
            codeChallengeMethod: "S256",
          }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          return body?.error ?? "Could not complete the desktop sign-in.";
        }

        const { callbackUrl } = (await res.json()) as { callbackUrl: string };

        // Assignment, not router.push: this is a custom scheme the router
        // knows nothing about, and the browser has to hand it to the OS.
        window.location.href = callbackUrl;
        return null;
      } catch {
        return "Could not reach the server.";
      }
    },
  };
}
