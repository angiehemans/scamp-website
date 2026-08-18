"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client. Safe to import from client components — it only
 * talks to /api/auth over HTTP and holds no secrets.
 *
 * baseURL is omitted deliberately so the client uses the origin it was served
 * from. Hardcoding localhost would break the moment the site is opened over a
 * LAN IP or the deployed domain.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
