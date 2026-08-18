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
});
