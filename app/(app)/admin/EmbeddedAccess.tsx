"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

type Account = { email: string; name: string; since: string };

async function setAccess(
  email: string,
  enabled: boolean,
): Promise<string | null> {
  const res = await fetch("/api/admin/embedded", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, enabled }),
  });
  if (res.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? `Could not save (${res.status}).`;
}

/**
 * Grant or revoke Edit React Project for an account. The route 404s for
 * non-admins, so this is convenience, not the access control. Refreshes
 * the server-rendered list rather than keeping a copy of it.
 */
export default function EmbeddedAccess({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (target: string, enabled: boolean) => {
    setBusy(true);
    setError(null);
    const failed = await setAccess(target, enabled);
    setBusy(false);
    if (failed) {
      setError(failed);
      return;
    }
    if (enabled) setEmail("");
    router.refresh();
  };

  return (
    <div className={styles.access}>
      <form
        className={styles.accessForm}
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) void change(email.trim(), true);
        }}
      >
        <input
          className={styles.accessInput}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@example.com"
          aria-label="Email of the account to give access"
        />
        <button
          className={styles.accessButton}
          type="submit"
          disabled={busy || !email.trim()}
        >
          Give access
        </button>
      </form>
      {error && <p className={styles.accessError}>{error}</p>}
      {accounts.length === 0 ? (
        <p className={styles.empty}>Only admins have access.</p>
      ) : (
        <ul className={styles.accessList}>
          {accounts.map((a) => (
            <li key={a.email} className={styles.accessRow}>
              <span>
                <span className={styles.userName}>{a.name}</span>{" "}
                <span className={styles.muted}>
                  {a.email} · since {a.since}
                </span>
              </span>
              <button
                className={styles.accessRevoke}
                type="button"
                disabled={busy}
                onClick={() => void change(a.email, false)}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
