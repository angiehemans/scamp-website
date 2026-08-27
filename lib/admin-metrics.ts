import { getPrisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/user-roles";

/**
 * Numbers for the admin page.
 *
 * ── What "active" means here ────────────────────────────────────────────────
 * DAU and MAU count distinct accounts whose `lastSeenAt` falls inside a rolling
 * 24-hour / 30-day window. `lastSeenAt` is written on authenticated requests
 * (throttled — see lib/session.ts), so it measures *signed-in visits*, not app
 * usage.
 *
 * That distinction matters and the UI says so: until cloud features ship, the
 * only thing to be active on is this website, so these are website engagement
 * numbers rather than product engagement. Once the desktop app talks to the
 * API, the same field starts meaning something much closer to real DAU.
 *
 * Rolling windows, not calendar days: "the last 24 hours" is stable regardless
 * of the reader's timezone, whereas a calendar day would need a timezone
 * decision that would then be wrong for half the year.
 */

export const DAU_WINDOW_HOURS = 24;
export const MAU_WINDOW_DAYS = 30;
export const SIGNUP_CHART_DAYS = 30;

export interface SignupPoint {
  /** ISO date, YYYY-MM-DD, UTC. */
  date: string;
  count: number;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  emailVerified: boolean;
  createdAt: Date;
  lastSeenAt: Date | null;
}

export interface DownloadRow {
  id: string;
  email: string | null;
  platform: string | null;
  createdAt: Date;
  /** Null while they have no account. Set if they signed up afterwards. */
  userId: string | null;
}

export interface AdminMetrics {
  /** Every recorded download, guest or signed-in. One row per download. */
  totalDownloads: number;
  downloadsLast7: number;
  downloadsPrev7: number;
  /** Downloads taken with no account. */
  guestDownloads: number;
  /** Distinct addresses captured from people who never made an account. */
  emailsWithoutAccount: number;
  /** Guest downloaders who later signed up. */
  guestConversions: number;
  downloadsByPlatform: { platform: string; count: number }[];
  downloadsByDay: SignupPoint[];
  recentGuestDownloads: DownloadRow[];
  totalUsers: number;
  verifiedUsers: number;
  signupsLast7: number;
  signupsPrev7: number;
  dau: number;
  mau: number;
  signupsByDay: SignupPoint[];
  roleBreakdown: { label: string; count: number }[];
  recentUsers: AdminUserRow[];
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000);

export async function getAdminMetrics(
  userLimit = 50,
): Promise<AdminMetrics> {
  const prisma = getPrisma();

  // Three batches rather than one 18-wide Promise.all.
  //
  // Prisma opens a connection per concurrent query, and eighteen at once is
  // enough for the local `prisma dev` proxy to drop one — the page then 500s
  // with "Connection terminated unexpectedly" on a completely healthy database.
  // Six at a time is still one round trip's worth of latency each and stays
  // well inside any pool.
  const [totalUsers, verifiedUsers, signupsLast7, signupsPrev7, dau, mau] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { createdAt: { gte: daysAgo(7) } } }),
      // The preceding 7 days, so the headline can show a real change rather
      // than a number with nothing to compare against.
      prisma.user.count({
        where: { createdAt: { gte: daysAgo(14), lt: daysAgo(7) } },
      }),
      prisma.user.count({
        where: { lastSeenAt: { gte: hoursAgo(DAU_WINDOW_HOURS) } },
      }),
      prisma.user.count({
        where: { lastSeenAt: { gte: daysAgo(MAU_WINDOW_DAYS) } },
      }),
    ]);

  const [signupRows, roleRows, recentUsers] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: daysAgo(SIGNUP_CHART_DAYS) } },
      select: { createdAt: true },
    }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: userLimit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        lastSeenAt: true,
      },
    }),
  ]);

  const [
    totalDownloads,
    downloadsLast7,
    downloadsPrev7,
    guestDownloads,
    guestEmailRows,
    guestConvertedRows,
    platformRows,
    downloadRows,
    recentGuestDownloads,
  ] = await Promise.all([
    prisma.purchase.count(),
    prisma.purchase.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    prisma.purchase.count({
      where: { createdAt: { gte: daysAgo(14), lt: daysAgo(7) } },
    }),
    prisma.purchase.count({ where: { wasGuest: true } }),
    // Distinct addresses, not rows: one person taking all three platforms is
    // one email, and counting rows would overstate the list.
    prisma.purchase.findMany({
      where: { wasGuest: true, userId: null, email: { not: null } },
      select: { email: true },
      distinct: ["email"],
    }),
    // A guest row whose userId is now filled in is someone who downloaded first
    // and signed up afterwards. wasGuest is what makes this answerable — see
    // the schema comment.
    prisma.purchase.findMany({
      where: { wasGuest: true, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.purchase.groupBy({ by: ["platform"], _count: { _all: true } }),
    prisma.purchase.findMany({
      where: { createdAt: { gte: daysAgo(SIGNUP_CHART_DAYS) } },
      select: { createdAt: true },
    }),
    prisma.purchase.findMany({
      where: { wasGuest: true },
      orderBy: { createdAt: "desc" },
      take: userLimit,
      select: {
        id: true,
        email: true,
        platform: true,
        createdAt: true,
        userId: true,
      },
    }),
  ]);

  const emptyDays = () => {
    const m = new Map<string, number>();
    for (let i = SIGNUP_CHART_DAYS - 1; i >= 0; i--) {
      m.set(daysAgo(i).toISOString().slice(0, 10), 0);
    }
    return m;
  };
  const bucket = (rows: { createdAt: Date }[]) => {
    const m = emptyDays();
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (m.has(key)) m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m].map(([date, count]) => ({ date, count }));
  };

  const buckets = bucket(signupRows);

  return {
    totalUsers,
    verifiedUsers,
    signupsLast7,
    signupsPrev7,
    dau,
    mau,
    signupsByDay: buckets,
    totalDownloads,
    downloadsLast7,
    downloadsPrev7,
    guestDownloads,
    emailsWithoutAccount: guestEmailRows.length,
    guestConversions: guestConvertedRows.length,
    downloadsByPlatform: platformRows
      .map((r) => ({ platform: r.platform ?? "unknown", count: r._count._all }))
      .sort((a, b) => b.count - a.count),
    downloadsByDay: bucket(downloadRows),
    recentGuestDownloads,
    roleBreakdown: roleRows
      .map((r) => ({
        label: roleLabel(r.role) ?? "Not asked",
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    recentUsers,
  };
}
