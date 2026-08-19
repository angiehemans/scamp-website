"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
// Type-only: erased at compile time, so the server module (and the database
// client it pulls in) never reaches the browser bundle.
import type { auth } from "@/lib/auth";

/**
 * Browser-side auth client. Safe to import from client components — it only
 * talks to /api/auth over HTTP and holds no secrets.
 *
 * baseURL is omitted deliberately so the client uses the origin it was served
 * from. Hardcoding localhost would break the moment the site is opened over a
 * LAN IP or the deployed domain.
 */
export const authClient = createAuthClient({
  // Teaches the client about `additionalFields` declared on the server — without
  // it, `signUp.email({ role })` is a type error and the value is stripped.
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
