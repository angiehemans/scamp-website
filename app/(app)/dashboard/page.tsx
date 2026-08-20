import Link from "next/link";
import { redirect } from "next/navigation";
import {
  IconBrandApple,
  IconBrandWindows,
  IconBrandDebian,
} from "@tabler/icons-react";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { GUMROAD_URL } from "@/lib/site";
import { PRO_FEATURES } from "@/lib/pro-features";
import DitherGradient from "@/components/DitherGradient/DitherGradient";
import SignOutButton from "./SignOutButton";
import ResendVerification from "../ResendVerification";
import styles from "./dashboard.module.css";

const PLATFORMS = [
  { label: "macOS", Icon: IconBrandApple },
  { label: "Windows", Icon: IconBrandWindows },
  { label: "Linux", Icon: IconBrandDebian },
];

/**
 * The signed-in home screen.
 *
 * Deliberately thin. Cloud features are not built, so there is nothing real to
 * show and no point inventing placeholder project lists — the honest content is
 * "download the app" and "here is what's coming". Account internals (row ids,
 * timestamps, verification state) were useful while proving the auth stack out
 * and are noise to an actual user, so they are gone.
 *
 * Route protection lives in the page rather than a proxy file: Better Auth
 * reads the session server-side, so no proxy is needed.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const firstName = user.name?.trim().split(/\s+/)[0] || "there";

  return (
    <main className={styles.main}>
      <DitherGradient variant="pageTop" />

      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.greeting}>
            <p className={styles.eyebrow}>Your account</p>
            <h1 className={styles.title}>Hello, {firstName}</h1>
          </div>
          <div className={styles.headerActions}>
            {/* Only rendered for admins — the page itself 404s for everyone
                else, so this is convenience, not the access control. */}
            {isAdmin(user) && (
              <Link href="/admin" className={styles.downloadBtn}>
                Metrics
              </Link>
            )}
            <SignOutButton />
          </div>
        </header>

        {/*
          Unverified accounts can sign in and use everything that exists today —
          the only thing gated is cloud backup, which is not shipped anyway.
          Blocking sign-in outright would strand anyone whose verification email
          went astray, with no way to request another.
        */}
        {!user.emailVerified && (
          <div className={styles.banner}>
            <p className={styles.bannerTitle}>Verify your email</p>
            <p className={styles.bannerBody}>
              We sent a link to <strong>{user.email}</strong>. Confirming it now
              means Scamp Cloud is ready for you the moment it launches.
            </p>
            <ResendVerification email={user.email} />
          </div>
        )}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Download Scamp</h2>
          </div>
          <p className={styles.panelBody}>
            The full design tool, free forever, with no feature limits. Your
            projects stay on your machine as real TSX and CSS files.
          </p>
          <div className={styles.downloadGrid}>
            {PLATFORMS.map(({ label, Icon }) => (
              <a
                key={label}
                href={GUMROAD_URL}
                target="_blank"
                rel="noreferrer"
                className={styles.downloadBtn}
              >
                <Icon className={styles.icon} aria-hidden="true" />
                {label}
              </a>
            ))}
          </div>
          <p className={styles.fineprint}>
            Already installed? Check the{" "}
            <Link href="/changelog" className={styles.link}>
              changelog
            </Link>{" "}
            for what&rsquo;s new.
          </p>
        </section>

        <section className={`${styles.panel} ${styles.comingSoon}`}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Scamp Cloud</h2>
            <span className={styles.badge}>Coming soon</span>
          </div>
          <p className={styles.panelBody}>
            Everything in the local app stays free. Cloud adds sharing, backup,
            and sync on top — you&rsquo;ll be able to switch it on from here.
          </p>

          {/* Shared with the pricing page — see lib/pro-features.ts */}
          <ul className={styles.featureList}>
            {PRO_FEATURES.map((feature) => (
              <li key={feature.title}>
                {feature.detail ? (
                  <>
                    <strong>{feature.title}</strong>: {feature.detail}
                  </>
                ) : (
                  feature.title
                )}
              </li>
            ))}
          </ul>

          <div className={styles.panelFooter}>
            <Link href="/pricing" className={styles.link}>
              See pricing →
            </Link>
            <span className={styles.fineprint}>
              Nothing to pay yet, and nothing happens automatically.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
