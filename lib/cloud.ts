import { getPrisma } from "@/lib/prisma";
import type { User } from "@/lib/generated/prisma/client";

/**
 * Scamp Cloud entitlement.
 *
 * One column, `User.cloudEnabledAt`, answers "does this account have cloud".
 * Everything that gates on it goes through `hasCloud()` so the rule lives in
 * one place; everything that grants it goes through `setCloudEnabled()`.
 *
 * ── Who can switch it on today ──────────────────────────────────────────────
 * Admins, for their own account, from the dashboard — and nobody else. There is
 * no billing yet, and the operator needs to use the product without a payment
 * plan that does not exist. When Stripe lands, a paid subscription becomes the
 * second writer of the same column, and this file is where the two meet.
 *
 * The admin check is deliberately NOT in here. `setCloudEnabled()` is a plain
 * write; the caller decides who may call it, so a future billing webhook can
 * reuse it without pretending to be an admin.
 */

export function hasCloud(user: Pick<User, "cloudEnabledAt">): boolean {
  return user.cloudEnabledAt !== null;
}

/**
 * Turns cloud on or off. Idempotent: switching on an account that is already
 * on keeps the original timestamp rather than resetting "since when".
 */
export async function setCloudEnabled(
  user: Pick<User, "id" | "cloudEnabledAt">,
  enabled: boolean,
): Promise<Date | null> {
  if (enabled && user.cloudEnabledAt) return user.cloudEnabledAt;
  if (!enabled && !user.cloudEnabledAt) return null;

  const value = enabled ? new Date() : null;
  await getPrisma().user.update({
    where: { id: user.id },
    data: { cloudEnabledAt: value },
  });
  return value;
}
