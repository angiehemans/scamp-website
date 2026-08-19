"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./auth.module.css";

/**
 * Only rendered when there is a session, so the address is known.
 *
 * Deliberately not an email input: an open "resend verification to this
 * address" form tells an attacker which addresses have accounts.
 */
export default function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">(
    "idle",
  );

  if (state === "sent") {
    return (
      <p className={styles.meta}>
        Sent. Check <strong>{email}</strong> for a new link.
      </p>
    );
  }

  return (
    <>
      <button
        className={styles.button}
        disabled={state === "sending"}
        onClick={async () => {
          setState("sending");
          const { error } = await authClient.sendVerificationEmail({
            email,
            callbackURL: "/verified",
          });
          setState(error ? "failed" : "sent");
        }}
      >
        {state === "sending" ? "Sending…" : "Send a new link"}
      </button>
      {state === "failed" && (
        <p className={styles.meta}>
          Could not send. Try again in a moment.
        </p>
      )}
    </>
  );
}
