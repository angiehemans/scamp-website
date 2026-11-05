"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { USER_ROLE_OPTIONS, type UserRole } from "@/lib/user-roles";
import { PRO_FEATURES } from "@/lib/pro-features";
import PasswordField from "../../../(app)/PasswordField";
import styles from "../download.module.css";

/**
 * Where Stripe returns after a successful payment.
 *
 * The download already started on the previous page, before the browser left
 * for Stripe — so this page's job is to confirm the payment and offer an
 * account, not to deliver anything. It offers the file link again anyway as a safety
 * net, because "my download did not start" has to have an answer.
 *
 * The email comes back from the Checkout Session, never from a form. Asking for
 * it again after someone has just paid — which the first version did — is the
 * kind of thing that makes people abandon the account entirely.
 */

interface Fulfilment {
  downloadUrl: string;
  filename: string;
  amountCents: number | null;
  email: string | null;
  hasAccount: boolean;
}

export default function ThanksFlow() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "ready" | "failed" | "done">(
    "working",
  );
  const [data, setData] = useState<Fulfilment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get(
      "session_id",
    );
    if (!sessionId) {
      setError("No checkout session. Nothing has been charged.");
      setState("failed");
      return;
    }

    void (async () => {
      try {
        const res = await fetch("/api/download/fulfil", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const body = (await res.json()) as Fulfilment & { error?: string };
        if (!res.ok) {
          setError(body.error ?? "Could not confirm your payment.");
          setState("failed");
          return;
        }
        setData(body);
        setState("ready");
      } catch {
        setError("Could not reach the server. Check your connection.");
        setState("failed");
      }
    })();
  }, []);

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.email) return;
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const { error } = await signUp.email({
      name: String(form.get("name")),
      email: data.email,
      password: String(form.get("password")),
      role: String(form.get("role")) as UserRole,
    });

    setPending(false);
    if (error) {
      setError(error.message ?? "Could not create the account.");
      return;
    }
    // The user-create hook attaches the purchase that just happened, so the
    // dashboard already knows about it.
    router.push("/dashboard");
    router.refresh();
  }

  if (state === "working") {
    return (
      <div className={styles.panel}>
        <p className={styles.panelBody}>Confirming your payment…</p>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Something went wrong</h2>
        <p className={styles.error}>{error}</p>
        <p className={styles.panelBody}>
          If you were charged, email{" "}
          <a href="mailto:angie@scamp.club" className={styles.link}>
            angie@scamp.club
          </a>{" "}
          and it will be sorted out.
        </p>
        <p className={styles.skip}>
          <Link href="/download" className={styles.link}>
            Back to downloads
          </Link>
        </p>
      </div>
    );
  }

  const amount =
    data?.amountCents != null ? (data.amountCents / 100).toFixed(0) : null;

  return (
    <div className={styles.panel}>
      <div className={styles.downloadingNote}>
        <p className={styles.downloadingTitle}>
          {amount ? `Thank you — $${amount} received` : "Thank you"}
        </p>
        <p className={styles.downloadingBody}>
          Your download of <strong>{data?.filename}</strong> started before
          checkout. If it did not,{" "}
          <a href={data?.downloadUrl} className={styles.link} download>
            download it again
          </a>
          . A receipt is on its way to your email.
        </p>
      </div>

      {data?.hasAccount ? (
        <>
          <div className={styles.divider} />
          <h2 className={styles.panelTitle}>You&rsquo;re all set</h2>
          <p className={styles.panelBody}>
            This purchase is on your account.
          </p>
          <p className={styles.skip}>
            <Link href="/dashboard" className={styles.link}>
              Go to your dashboard
            </Link>
          </p>
        </>
      ) : (
        <>
          <div className={styles.divider} />
          <h2 className={styles.panelTitle}>Want an account?</h2>
          <p className={styles.panelBody}>
            Optional, and nothing about Scamp is locked behind it. What it gets
            you:
          </p>

          <ul className={styles.benefits}>
            <li>
              <strong>Your downloads in one place</strong>, on any machine,
              without hunting for a link
            </li>
            <li>
              <strong>New releases</strong> as they ship, with the changelog
            </li>
            <li>
              <strong>Scamp Cloud at launch</strong> —{" "}
              {PRO_FEATURES.slice(0, 3)
                .map((f) => f.title.toLowerCase())
                .join(", ")}
              , and more
            </li>
          </ul>

          {error && <p className={styles.error}>{error}</p>}

          <form className={styles.form} onSubmit={createAccount}>
            <label className={styles.label}>
              Email
              <input
                className={`${styles.input} ${styles.inputLocked}`}
                value={data?.email ?? ""}
                readOnly
              />
            </label>

            <label className={styles.label}>
              Name
              <input
                className={styles.input}
                name="name"
                type="text"
                autoComplete="name"
                required
              />
            </label>

            <PasswordField autoComplete="new-password" />

            <label className={styles.label}>
              What do you do?
              <select
                className={styles.select}
                name="role"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose one
                </option>
                {USER_ROLE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <button className={styles.submit} type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create account"}
            </button>
          </form>

          <p className={styles.skip}>
            <Link href="/docs" className={styles.link}>
              No thanks, take me to the docs
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
