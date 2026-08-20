import type { User } from "@/lib/generated/prisma/client";

/**
 * Who can see the admin page.
 *
 * Deliberately an environment variable rather than a database column. Admin
 * access then cannot be granted by anything that writes to the database — a bug
 * in a signup path, a stray migration, an injection — only by someone who can
 * change a Worker secret and redeploy. For a single-operator product that
 * tradeoff is entirely one-sided.
 *
 * Set as a comma-separated list:
 *   npx wrangler secret put ADMIN_EMAILS
 *   angie@scamp.club,someone@else.com
 *
 * Unset means nobody is an admin, including locally. That is the safe default:
 * a missing secret must never open the page up.
 *
 * The account must also be verified. Listing an address that has not signed up
 * yet — a colleague you are about to onboard — would otherwise leave a window
 * where anyone who knows the list can register that address and read the page.
 * Owning the mailbox is the thing being checked, so make it check the mailbox.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function isAdmin(
  user: Pick<User, "email" | "emailVerified"> | null,
): boolean {
  if (!user || !user.emailVerified) return false;

  const allowed = adminEmails().map((e) => e.toLowerCase());
  if (allowed.length === 0) return false;
  return allowed.includes(user.email.trim().toLowerCase());
}
