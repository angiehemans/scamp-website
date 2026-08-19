// Shared helpers for the checkpoint scripts.
//
// Cloud backup requires a verified email address (see checkCanSync in
// lib/api-auth.ts), so a freshly signed-up account cannot use any of it. The
// scripts therefore need to simulate the user clicking the verification link.
//
// Flipping the column directly is deliberate: extracting a real token would
// mean scraping the dev server's log, which is fragile and would couple the
// tests to log formatting. The verification flow itself is covered separately
// by following an actual emailed link.

import "dotenv/config";
import pg from "pg";

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";
export const ORIGIN = BASE;
export const PASSWORD = "correct-horse-battery";

const json = { "Content-Type": "application/json", origin: ORIGIN };

async function withDb(fn) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Signs up and returns { email, cookie, call } WITHOUT verifying. */
export async function signUp(email, name = "Test User") {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ name, email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`sign-up failed for ${email}: ${res.status}`);

  const cookie = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");

  // Exposed under both names: the checkpoints were written against `.fetch`,
  // newer code reads better as `.call`.
  const call = (path, init = {}) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...json, cookie, ...(init.headers ?? {}) },
    });

  return { email, cookie, call, fetch: call };
}

/** Marks an existing account verified, as clicking the emailed link would. */
export async function markVerified(email) {
  await withDb((c) =>
    c.query('update "user" set "emailVerified" = true where email = $1', [
      email,
    ]),
  );
}

/** Signs up and verifies, which is what most checkpoints need. */
export async function signUpVerified(email, name = "Test User") {
  const user = await signUp(email, name);
  await markVerified(email);
  return user;
}

/** Removes accounts created by the checkpoints. */
export async function cleanUp(patterns) {
  return withDb(async (c) => {
    let total = 0;
    for (const p of patterns) {
      const { rowCount } = await c.query(
        'delete from "user" where email like $1',
        [p],
      );
      total += rowCount;
    }
    return total;
  });
}
