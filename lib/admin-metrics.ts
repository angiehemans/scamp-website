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

export interface AdminMetrics {
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

  const [
    totalUsers,
    verifiedUsers,
    signupsLast7,
    signupsPrev7,
    dau,
    mau,
    signupRows,
    roleRows,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    // The preceding 7 days, so the headline can show a real change rather than
    // a number with nothing to compare against.
    prisma.user.count({
      where: { createdAt: { gte: daysAgo(14), lt: daysAgo(7) } },
    }),
    prisma.user.count({
      where: { lastSeenAt: { gte: hoursAgo(DAU_WINDOW_HOURS) } },
    }),
    prisma.user.count({
      where: { lastSeenAt: { gte: daysAgo(MAU_WINDOW_DAYS) } },
    }),
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

  // Bucket in JS rather than SQL: the row count over 30 days is tiny, and this
  // avoids a raw query that would need rewriting per database.
  const buckets = new Map<string, number>();
  for (let i = SIGNUP_CHART_DAYS - 1; i >= 0; i--) {
    buckets.set(daysAgo(i).toISOString().slice(0, 10), 0);
  }
  for (const row of signupRows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return {
    totalUsers,
    verifiedUsers,
    signupsLast7,
    signupsPrev7,
    dau,
    mau,
    signupsByDay: [...buckets].map(([date, count]) => ({ date, count })),
    roleBreakdown: roleRows
      .map((r) => ({
        label: roleLabel(r.role) ?? "Not asked",
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    recentUsers,
  };
}
