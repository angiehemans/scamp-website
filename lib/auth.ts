import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getPrisma } from "@/lib/prisma";
import {
  sendEmail,
  verificationEmail,
  signupNotificationEmail,
} from "@/lib/email";
import { adminEmails } from "@/lib/admin";
import { USER_ROLE_VALUES, roleLabel } from "@/lib/user-roles";
import { z } from "zod";

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
const isWorkers =
  typeof navigator !== "undefined" &&
  navigator.userAgent === "Cloudflare-Workers";

export const buildAuth = () =>
  betterAuth({
  database: prismaAdapter(getPrisma(), {
    provider: "postgresql",
    // Already the adapter's default — stated explicitly so it cannot be
    // switched on without someone reading this.
    //
    // The Neon HTTP driver used on Workers cannot open a transaction, so
    // turning this on would break every write in production while continuing
    // to pass locally on the TCP adapter.
    transaction: false,
  }),
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

  user: {
    additionalFields: {
      /**
       * What the person does. Collected at sign-up for product research.
       *
       * The literal-array `type` only shapes the TypeScript type — it does
       * NOT validate at runtime. Verified the hard way: a sign-up with
       * `role: "ceo"` returned 200 and stored it. The `validator` below is what
       * actually rejects values outside the list, so do not remove it on the
       * assumption that the type is doing the work.
       *
       * Nullable on purpose. Accounts created before this existed were never
       * asked, and `null` says exactly that; defaulting them to "other" would
       * invent an answer nobody gave and quietly corrupt the numbers.
       *
       * NOTE: Better Auth's admin plugin also puts a `role` field on the user
       * model (admin/user permissions). If that plugin is ever added, remap one
       * of the two via its `schema.user.fields` option, or they will collide.
       */
      role: {
        type: [...USER_ROLE_VALUES],
        required: false,
        input: true,
        validator: { input: z.enum(USER_ROLE_VALUES) },
      },

      /**
       * Last time this account was seen on an authenticated request. Powers
       * DAU/MAU on the admin page.
       *
       * Declared here rather than added straight to schema.prisma so it
       * survives `@better-auth/cli generate`, which regenerates that file from
       * this config and drops anything it does not know about.
       *
       * `input: false` — set by the server, never accepted from a client.
       */
      lastSeenAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * Tell the operator every time someone signs up.
         *
         * On the database hook rather than inside the email/password handler so
         * it fires for every way an account can come into existence — adding
         * OAuth later must not silently stop the notifications.
         *
         * Two deliberate choices:
         *
         * `await`, not fire-and-forget. A floating promise is the obvious way to
         * keep sign-up fast, and it is wrong on Workers: the request context is
         * torn down after the response, and continuing to use it throws "Cannot
         * perform I/O on behalf of a different request" — the same failure that
         * forced getPrisma() to be per-request. Sign-up pays one Resend round
         * trip. That is the correct trade against silently losing notifications.
         *
         * Everything is swallowed. This is a courtesy email to one person; if
         * Resend is down or the key is wrong, the person signing up must still
         * get their account. Nothing about their sign-up depends on this
         * succeeding, so nothing about it should be able to fail their sign-up.
         */
        async after(user) {
          const to = adminEmails();
          if (to.length === 0) return;

          try {
            const record = user as typeof user & { role?: string | null };
            await sendEmail({
              to,
              ...signupNotificationEmail({
                name: user.name,
                email: user.email,
                role: roleLabel(record.role ?? null),
              }),
            });
          } catch (error) {
            console.error(
              `[signup-notify] could not notify admins about ${user.email}:`,
              error,
            );
          }
        },
      },
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

/**
 * The Better Auth instance for the current request.
 *
 * Built per call rather than once at module scope, because the Prisma client it
 * wraps must be per request on Workers — see getPrisma(). Node caches it, so
 * the construction cost is only paid where it is actually required.
 *
 * Never export a module-scoped `auth`: it would pin one Prisma client for the
 * isolate's lifetime and reintroduce the cross-request I/O failure this exists
 * to avoid.
 */
let cachedAuth: ReturnType<typeof buildAuth> | null = null;

export function getAuth(): ReturnType<typeof buildAuth> {
  if (isWorkers) return buildAuth();
  if (!cachedAuth) cachedAuth = buildAuth();
  return cachedAuth;
}
