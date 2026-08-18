import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

/**
 * Better Auth server instance.
 *
 * Auth is a library here, not a hosted service: the user, session, account and
 * verification tables live in this project's own Postgres, generated into
 * prisma/schema.prisma by `npx @better-auth/cli generate`. There is no external
 * user directory to reconcile, which is why there is no `clerkId`-style join
 * column anywhere in the schema.
 *
 * Server-only. Never import this from a client component — it would pull the
 * database client and BETTER_AUTH_SECRET into the browser bundle. Client code
 * uses lib/auth-client.ts instead.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // Deferred to a later phase: verification needs Resend wired up, and
    // turning it on now would block local signup on an email that never
    // arrives. Must be enabled before launch.
    requireEmailVerification: false,
  },

  advanced: {
    ipAddress: {
      // Without this, Better Auth cannot resolve a client IP behind Cloudflare
      // and falls back to ONE shared rate-limit bucket for every visitor —
      // which means no per-attacker throttling at all. `cf-connecting-ip` is
      // set by Cloudflare and cannot be spoofed by the client.
      //
      // Deliberately not `x-forwarded-for`: that is a client-supplied,
      // comma-separated chain, so anyone could forge a fresh IP per request and
      // sidestep the limit entirely.
      ipAddressHeaders: ["cf-connecting-ip"],
    },
  },

  rateLimit: {
    // Database, not the in-memory default. Workers isolates do not share
    // memory, so an in-memory counter resets constantly and provides almost no
    // brute-force protection. Costs a read and a write per rate-limited
    // request; correctness matters more than that here.
    storage: "database",
  },
});
