import { getPrisma } from "@/lib/prisma";
import { PURCHASE_STATUS } from "@/lib/purchase-status";
import { adminEmails } from "@/lib/admin";
import { sendEmail, downloadNotificationEmail } from "@/lib/email";
import { afterResponse } from "@/lib/after-response";

/**
 * Reads and writes for the pay-what-you-want flow.
 *
 * Nothing in here gates a download. `hasResponded` decides whether to *ask*
 * again, which is a courtesy question, not an access one — see
 * plans/paid-downloads.md.
 */

/**
 * Has this account already answered the pay-what-you-want prompt?
 *
 * True for $0 as well as for a real payment: someone who declined has given
 * their answer, and asking again on every download would be nagging. A
 * `pending` row does not count — an abandoned Checkout session must not silence
 * the prompt forever.
 */
export async function hasResponded(userId: string): Promise<boolean> {
  const count = await getPrisma().purchase.count({
    where: {
      userId,
      status: { in: [PURCHASE_STATUS.FREE, PURCHASE_STATUS.PAID] },
    },
  });
  return count > 0;
}

/**
 * Records a decision to pay nothing.
 *
 * `amountCents` is hard-coded to 0 rather than taken as a parameter. This is
 * the endpoint anyone on the internet can POST to without paying, so if it
 * could write a caller-supplied amount, the revenue figures on /admin would be
 * whatever a stranger typed. Non-zero amounts have to go through Stripe, where
 * the number is corroborated by money arriving.
 */
export async function recordFreeClaim(
  userId: string,
  platform: string | null,
  email: string | null = null,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.purchase.create({
    data: {
      userId,
      email,
      amountCents: 0,
      status: PURCHASE_STATUS.FREE,
      platform,
    },
  });

  // The address is on the account, not the row, for a signed-in claim.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  await notifyDownload({
    email: email ?? user?.email ?? "unknown",
    platform: platform ?? "unknown",
    hasAccount: true,
  });
}

/**
 * Records a download by someone with no account.
 *
 * Same zero-only rule as the signed-in path, for the same reason: this endpoint
 * is reachable by anyone on the internet, so it must not be able to assert that
 * money arrived.
 */
export async function recordGuestClaim(
  email: string,
  platform: string,
  ipHash: string | null,
): Promise<void> {
  await getPrisma().purchase.create({
    data: {
      userId: null,
      email: email.trim().toLowerCase(),
      ipHash,
      amountCents: 0,
      status: PURCHASE_STATUS.FREE,
      platform,
      // Stays true even after the account is created and userId is filled in —
      // it records how the download happened, not who owns it now.
      wasGuest: true,
    },
  });

  await notifyDownload({ email, platform, hasAccount: false });
}

/**
 * Tells the operator someone downloaded.
 *
 * Sent *after* the response via afterResponse(), unlike the sign-up
 * notification which blocks. The difference is what the caller is waiting for:
 * a sign-up response is the end of the interaction, whereas this response
 * carries the URL the browser is about to fetch — adding a Resend round trip
 * would delay the file starting.
 *
 * Everything is swallowed. A courtesy email must never be able to fail a
 * download.
 */
async function notifyDownload(info: {
  email: string;
  platform: string;
  hasAccount: boolean;
}): Promise<void> {
  const to = adminEmails();
  if (to.length === 0) return;

  await afterResponse(
    (async () => {
      // Counted after the insert above, so the number in the email includes
      // this download rather than being one behind.
      const runningTotal = await getPrisma().purchase.count();
      await sendEmail({
        to,
        ...downloadNotificationEmail({ ...info, runningTotal }),
      });
    })(),
  );
}

/**
 * Attaches any guest downloads to a newly created account.
 *
 * Called from the user-create hook, so someone who downloaded first and signed
 * up afterwards is one person in the numbers rather than two. Matching is on
 * the email they typed at download time, which is unverified — worth knowing,
 * but the only thing it can do is credit a $0 download to the account that
 * claimed the same address, which is not worth attacking.
 */
export async function linkGuestPurchases(
  userId: string,
  email: string,
): Promise<number> {
  const { count } = await getPrisma().purchase.updateMany({
    where: { userId: null, email: email.trim().toLowerCase() },
    data: { userId },
  });
  return count;
}

/**
 * How many downloads per IP per hour the open guest endpoint allows.
 *
 * Generous on purpose: the thing being prevented is a script filling the table,
 * not a person downloading three platforms and then retrying one. Nothing of
 * value is behind this, so a limit tight enough to inconvenience a real user
 * would cost more than it saves.
 */
export const GUEST_CLAIMS_PER_HOUR = 20;

export async function guestClaimsRecently(ipHash: string): Promise<number> {
  return getPrisma().purchase.count({
    where: {
      ipHash,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
}
