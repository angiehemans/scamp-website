import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import ResendVerification from "../ResendVerification";
import DitherGradient from "@/components/DitherGradient/DitherGradient";
import styles from "../auth.module.css";

/**
 * Where the verification link lands.
 *
 * Better Auth redirects here after processing the token: with no query string
 * on success, and with `?error=INVALID_TOKEN` on failure. Without this page the
 * callback defaulted to `/`, so a user who clicked the link got the homepage
 * and no way to tell whether it had worked.
 *
 * Reads the user from the database rather than trusting the absence of an
 * error param — `autoSignInAfterVerification` means a successful verification
 * usually leaves a session, so the actual `emailVerified` value can be shown
 * instead of inferred.
 */
export default async function VerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  const succeeded = !error && (user?.emailVerified ?? true);

  return (
    <main className={styles.main}>
      {/*
        A centred variant, because the card is vertically centred — the top-glow
        variants (accentTopCenter and friends) hang above it with nothing to
        relate to, which reads as a stray artefact rather than a backdrop.

        Success gets the neutral grey wash so it feels like an arrival rather
        than another form; failure keeps the same blue as sign-in and sign-up,
        which is where the user is headed next.
      */}
      <DitherGradient variant={succeeded ? "center" : "centerBlue"} />
      <div className={styles.card}>
        {succeeded ? (
          <>
            <p className={styles.success}>✓ Email verified</p>
            <h1 className={styles.title}>You&rsquo;re all set</h1>
            <p className={styles.meta}>
              {user?.email ? (
                <>
                  <strong>{user.email}</strong> is confirmed.
                </>
              ) : (
                "Your email address is confirmed."
              )}
            </p>
            <Link
              className={styles.button}
              href={user ? "/dashboard" : "/sign-in"}
            >
              {user ? "Go to dashboard" : "Sign in"}
            </Link>
          </>
        ) : (
          <>
            <p className={styles.error}>This link didn&rsquo;t work</p>
            <h1 className={styles.title}>Link expired or already used</h1>
            <p className={styles.meta}>
              Verification links last one hour and work once. If you already
              verified, you can just sign in.
            </p>

            {user ? (
              <ResendVerification email={user.email} />
            ) : (
              <Link className={styles.button} href="/sign-in">
                Sign in
              </Link>
            )}

            <p className={styles.meta}>
              Still stuck? Reply to the verification email and I&rsquo;ll sort it
              out.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
