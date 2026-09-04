"use client";

import { useState } from "react";
import styles from "./auth.module.css";

/**
 * Shown on the sign-in and sign-up pages when the desktop app opened them and
 * the person is already signed in here.
 *
 * Without this, a signed-in user was asked for their password again purely to
 * mint a code for the app. The session is already proof of who they are, so
 * the page offers to hand it over as-is. The form stays underneath for anyone
 * who wants the app signed in as someone else.
 */
export default function ContinueToDesktop({
  email,
  onContinue,
}: {
  email: string;
  /** Completes the desktop handoff. Returns an error string, or null once the
   *  browser is already navigating to the app. */
  onContinue: () => Promise<string | null>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={styles.form}>
      <p className={styles.meta}>
        You&rsquo;re signed in as <strong>{email}</strong>.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <button
        className={styles.button}
        type="button"
        disabled={pending}
        onClick={async () => {
          setError(null);
          setPending(true);
          const failure = await onContinue();
          if (failure) {
            setError(failure);
            setPending(false);
          }
        }}
      >
        {pending ? "Opening Scamp…" : "Continue to the app"}
      </button>
      <p className={styles.locked}>Or sign in below as someone else.</p>
    </div>
  );
}
