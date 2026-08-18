import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import SignOutButton from "./SignOutButton";
import styles from "../auth.module.css";

/**
 * The success state for Phase 1 of plans/auth-setup-phase-1.md.
 *
 * Route protection lives in the page itself rather than in a proxy file: Better
 * Auth reads the session server-side, so no proxy is needed, and skipping it
 * avoids the Next 16 middleware/proxy rename entirely.
 *
 * Every value shown below is read back out of Postgres rather than from the
 * session object, so if this page renders, the ORM, the database, and the
 * session are all provably working.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.success}>✓ Signed in</p>

        <h1 className={styles.title}>{user.name}</h1>

        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.rowKey}>Email</span>
            <span className={styles.rowValue}>{user.email}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowKey}>Database row id</span>
            <span className={styles.rowValue}>{user.id}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowKey}>Email verified</span>
            <span className={styles.rowValue}>
              {user.emailVerified ? "yes" : "no"}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowKey}>Created</span>
            <span className={styles.rowValue}>
              {user.createdAt.toISOString()}
            </span>
          </div>
        </div>

        <p className={styles.meta}>
          These values came from Postgres via Prisma, not from the session
          cookie.
        </p>

        <SignOutButton />
      </div>
    </main>
  );
}
