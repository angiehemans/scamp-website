import { getPrisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import type { User } from "@/lib/generated/prisma/client";

/**
 * Desktop features still behind a flag.
 *
 * Edit React Project ("embedded") is on for admins automatically, and for
 * anyone an admin switches it on for, recorded in `User.embeddedEnabledAt`.
 * The desktop app reads the answer from GET /api/desktop/features; the app
 * also refuses to open the window without it, so hiding the button is not
 * the only gate.
 *
 * Like lib/cloud.ts, the admin check for *changing* the flag lives in the
 * route that calls `setEmbeddedEnabled()`, not here.
 */

export type DesktopFeatures = { embedded: boolean };

export function featuresFor(
  user: Pick<User, "email" | "emailVerified" | "embeddedEnabledAt">,
): DesktopFeatures {
  return { embedded: isAdmin(user) || user.embeddedEnabledAt !== null };
}

/**
 * Turns the flag on or off for an account. Idempotent: switching on an
 * account that is already on keeps the original timestamp.
 */
export async function setEmbeddedEnabled(
  user: Pick<User, "id" | "embeddedEnabledAt">,
  enabled: boolean,
): Promise<Date | null> {
  if (enabled && user.embeddedEnabledAt) return user.embeddedEnabledAt;
  if (!enabled && !user.embeddedEnabledAt) return null;

  const value = enabled ? new Date() : null;
  await getPrisma().user.update({
    where: { id: user.id },
    data: { embeddedEnabledAt: value },
  });
  return value;
}
