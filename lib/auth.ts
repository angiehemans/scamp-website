import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendEmail, verificationEmail } from "@/lib/email";

/**
 * Whether an unverified user is blocked from signing in.
 *
 * Kept OFF until Resend is proven in production, and this ordering is
 * deliberate rather than timid: every account that exists today has
 * `emailVerified: false`, so switching this on before mail is confirmed
 * working locks everyone — including you — out of the deployed site, with no
 * way back in except a database edit.
 *
 * Verification emails are already sent on sign-up regardless of this flag, so
 * the flow is fully testable while it is off.
 *
 * TO TURN ON:
 *   1. Confirm a real verification email arrives in production.
 *   2. Backfill existing accounts:  node scripts/verify-existing-users.mjs
 *   3. Flip this to true, redeploy.
 */
const REQUIRE_EMAIL_VERIFICATION = false;

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
    requireEmailVerification: REQUIRE_EMAIL_VERIFICATION,
  },

  emailVerification: {
    // Send on sign-up even while enforcement is off, so the path is exercised
    // and a real inbox proves it works before anyone depends on it.
    sendOnSignUp: true,
    // Land the user in the app rather than on a "now please sign in" page.
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      // Better Auth defaults `callbackURL` to "/", so a verified user lands on
      // the homepage with no indication anything happened — they have to go
      // looking to find out whether it worked. Point it at a page that says so.
      //
      // On failure Better Auth appends `?error=INVALID_TOKEN` to the same
      // callback, so one page covers both outcomes.
      const link = new URL(url);
      link.searchParams.set("callbackURL", "/verified");

      await sendEmail({
        to: user.email,
        ...verificationEmail(link.toString()),
      });
    },
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
