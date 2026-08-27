import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import {
  getAdminMetrics,
  DAU_WINDOW_HOURS,
  MAU_WINDOW_DAYS,
  SIGNUP_CHART_DAYS,
} from "@/lib/admin-metrics";
import { roleLabel } from "@/lib/user-roles";
import { platformLabel } from "@/lib/platforms";
import styles from "./admin.module.css";

/**
 * Internal metrics. Not linked from anywhere.
 *
 * A non-admin gets `notFound()`, not a 403 — same reasoning as the project API.
 * A 403 confirms the page exists and is worth attacking; a 404 is
 * indistinguishable from a typo.
 */

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const fullFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function relative(date: Date | null): string {
  if (!date) return "never";
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : fullFmt.format(date);
}

/**
 * A 30-day bar chart. Single series, so no legend — the heading names it.
 *
 * Shared by sign-ups and downloads so the two read identically; a reader
 * comparing them should not have to decode two different charts.
 */
function DayChart({
  points,
  noun,
}: {
  points: { date: string; count: number }[];
  noun: string;
}) {
  const peak = Math.max(1, ...points.map((d) => d.count));
  return (
    <figure className={styles.figure}>
      <div className={styles.chart}>
        {points.map((d) => {
          const label = `${fullFmt.format(new Date(d.date))}: ${d.count} ${noun}${d.count === 1 ? "" : "s"}`;
          return (
            <div
              key={d.date}
              className={styles.barWrap}
              tabIndex={0}
              role="img"
              aria-label={label}
            >
              <span className={styles.tooltip} aria-hidden="true">
                {label}
              </span>
              <div
                className={`${styles.bar} ${d.count === 0 ? styles.barEmpty : ""}`}
                style={{ height: `${(d.count / peak) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className={styles.axis}>
        <span>{dateFmt.format(new Date(points[0]?.date ?? Date.now()))}</span>
        <span>peak {peak}/day</span>
        <span>today</span>
      </div>
      <figcaption className={styles.caption}>
        Each bar is one UTC day. Hover or tab a bar for the exact count.
      </figcaption>
    </figure>
  );
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();

  const m = await getAdminMetrics();
  const delta = m.signupsLast7 - m.signupsPrev7;
  const dlDelta = m.downloadsLast7 - m.downloadsPrev7;

  return (
    <main className={styles.main}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Admin</p>
            <h1 className={styles.title}>Metrics</h1>
          </div>
          <Link href="/dashboard" className={styles.backLink}>
            ← Dashboard
          </Link>
        </header>

        {/* Headline numbers are stat tiles, not a chart — a four-bar bar chart
            would be harder to read than the four numbers themselves. */}
        <div className={styles.kpiRow}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Total sign-ups</span>
            <span className={styles.tileValue}>
              {m.totalUsers.toLocaleString("en-GB")}
            </span>
            <span className={styles.tileDelta}>
              {m.verifiedUsers.toLocaleString("en-GB")} verified
            </span>
          </div>

          <div className={styles.tile}>
            <span className={styles.tileLabel}>Sign-ups, last 7 days</span>
            <span className={styles.tileValue}>
              {m.signupsLast7.toLocaleString("en-GB")}
            </span>
            <span
              className={`${styles.tileDelta} ${
                delta > 0 ? styles.deltaUp : delta < 0 ? styles.deltaDown : ""
              }`}
            >
              {delta === 0
                ? "same as previous 7 days"
                : `${delta > 0 ? "+" : ""}${delta} vs previous 7 days`}
            </span>
          </div>

          <div className={styles.tile}>
            <span className={styles.tileLabel}>Downloads</span>
            <span className={styles.tileValue}>
              {m.totalDownloads.toLocaleString("en-GB")}
            </span>
            <span
              className={`${styles.tileDelta} ${
                dlDelta > 0
                  ? styles.deltaUp
                  : dlDelta < 0
                    ? styles.deltaDown
                    : ""
              }`}
            >
              {m.downloadsLast7} in the last 7 days
              {dlDelta !== 0 && ` (${dlDelta > 0 ? "+" : ""}${dlDelta})`}
            </span>
          </div>

          <div className={styles.tile}>
            <span className={styles.tileLabel}>Emails, no account</span>
            <span className={styles.tileValue}>
              {m.emailsWithoutAccount.toLocaleString("en-GB")}
            </span>
            <span className={styles.tileDelta}>
              {m.guestDownloads > 0
                ? `${Math.round((m.guestConversions / m.guestDownloads) * 100)}% of guest downloads became accounts`
                : "no guest downloads yet"}
            </span>
          </div>

          <div className={styles.tile}>
            <span className={styles.tileLabel}>Active, last 24h</span>
            <span className={styles.tileValue}>
              {m.dau.toLocaleString("en-GB")}
            </span>
            <span className={styles.tileDelta}>
              {m.totalUsers > 0
                ? `${Math.round((m.dau / m.totalUsers) * 100)}% of all accounts`
                : "—"}
            </span>
          </div>

          <div className={styles.tile}>
            <span className={styles.tileLabel}>
              Active, last {MAU_WINDOW_DAYS} days
            </span>
            <span className={styles.tileValue}>
              {m.mau.toLocaleString("en-GB")}
            </span>
            <span className={styles.tileDelta}>
              {m.mau > 0
                ? `${Math.round((m.dau / m.mau) * 100)}% stickiness`
                : "—"}
            </span>
          </div>
        </div>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>
            Sign-ups, last {SIGNUP_CHART_DAYS} days
          </h2>

          <DayChart points={m.signupsByDay} noun="sign-up" />
        </section>

        {/* Downloads matter more than sign-ups now: an account is optional, so
            most downloads never become one. Kept as its own section rather than
            folded into the sign-up numbers, which measure something else. */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>
              Downloads, last {SIGNUP_CHART_DAYS} days
            </h2>
            <span className={styles.tileDelta}>
              {m.totalDownloads.toLocaleString("en-GB")} all time
            </span>
          </div>
          <DayChart points={m.downloadsByDay} noun="download" />

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Platform</th>
                  <th scope="col">Downloads</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {m.downloadsByPlatform.map((r) => (
                  <tr key={r.platform}>
                    <td>{platformLabel(r.platform)}</td>
                    <td className={styles.num}>{r.count}</td>
                    <td className={styles.num}>
                      {m.totalDownloads > 0
                        ? `${Math.round((r.count / m.totalDownloads) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {m.downloadsByPlatform.length === 0 && (
            <p className={styles.empty}>No downloads yet.</p>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Emails without an account</h2>
            <span className={styles.tileDelta}>
              {m.guestConversions.toLocaleString("en-GB")} later signed up
            </span>
          </div>
          <p className={styles.panelBody}>
            People who downloaded from the marketing pages and gave an email but
            never created an account. This is the list you can actually reach.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Platform</th>
                  <th scope="col">Downloaded</th>
                  <th scope="col">Account</th>
                </tr>
              </thead>
              <tbody>
                {m.recentGuestDownloads.map((d) => (
                  <tr key={d.id}>
                    <td className={styles.userName}>{d.email ?? "—"}</td>
                    <td>{d.platform ? platformLabel(d.platform) : "—"}</td>
                    <td className={styles.num}>{fullFmt.format(d.createdAt)}</td>
                    <td>
                      <span
                        className={`${styles.pill} ${d.userId ? styles.pillYes : styles.pillNo}`}
                      >
                        {d.userId ? "signed up" : "no account"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {m.recentGuestDownloads.length === 0 && (
            <p className={styles.empty}>No guest downloads yet.</p>
          )}
          <p className={styles.panelNote}>
            One row per download, so someone taking macOS and Windows appears
            twice. The tile above counts distinct addresses.
          </p>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>What people say they do</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Accounts</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {m.roleBreakdown.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td className={styles.num}>{r.count}</td>
                    <td className={styles.num}>
                      {m.totalUsers > 0
                        ? `${Math.round((r.count / m.totalUsers) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.panelNote}>
            &ldquo;Not asked&rdquo; means the account predates the question —
            distinct from someone choosing &ldquo;Other&rdquo;.
          </p>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Recent sign-ups</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Verified</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {m.recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td className={styles.userName}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{roleLabel(u.role) ?? <span className={styles.muted}>—</span>}</td>
                    <td>
                      <span
                        className={`${styles.pill} ${u.emailVerified ? styles.pillYes : styles.pillNo}`}
                      >
                        {u.emailVerified ? "yes" : "pending"}
                      </span>
                    </td>
                    <td className={styles.num}>{fullFmt.format(u.createdAt)}</td>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {relative(u.lastSeenAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {m.recentUsers.length === 0 && (
            <p className={styles.empty}>No accounts yet.</p>
          )}
        </section>

        <p className={styles.panelNote}>
          <strong>What &ldquo;active&rdquo; measures:</strong> an account is
          counted as active if it made a signed-in request in the last{" "}
          {DAU_WINDOW_HOURS} hours (or {MAU_WINDOW_DAYS} days). Until cloud
          features ship, the only place to be signed in is this website — so
          these are website engagement numbers, not product usage. They will
          start meaning something closer to real DAU once the desktop app talks
          to the API.
        </p>
      </div>
    </main>
  );
}
