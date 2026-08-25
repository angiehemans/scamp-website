"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconBrandApple,
  IconBrandWindows,
  IconBrandDebian,
} from "@tabler/icons-react";
import { signUp } from "@/lib/auth-client";
import { USER_ROLE_OPTIONS, type UserRole } from "@/lib/user-roles";
import { SUGGESTED_AMOUNTS, MAX_PAID_CENTS } from "@/lib/purchase-status";
import PasswordField from "../../(app)/PasswordField";
import styles from "./download.module.css";

/**
 * The public download flow. See §4.5 of plans/paid-downloads.md.
 *
 *   1. email + platform + amount   → the file starts downloading
 *   2. the same panel becomes      → "want an account?" (name, password, role)
 *
 * No account is required at any point. The upsell is offered *after* the
 * download begins, because that is the one moment the visitor already has what
 * they came for and is waiting anyway — asking first would trade a download for
 * a form.
 *
 * Lives in the marketing route group, which must stay static. That is fine: the
 * page shell is static and every decision here happens client-side, so nothing
 * reads a cookie at render time.
 */

const PLATFORMS = [
  { slug: "macos", label: "macOS", Icon: IconBrandApple },
  { slug: "windows", label: "Windows", Icon: IconBrandWindows },
  { slug: "linux", label: "Linux", Icon: IconBrandDebian },
] as const;

type Step = "form" | "downloading" | "account" | "done";

export default function DownloadFlow() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState<string>("macos");
  const [selected, setSelected] = useState<number>(SUGGESTED_AMOUNTS[0]);
  const [custom, setCustom] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const isCustom = selected === -1;
  const customDollars = Number(custom);
  const dollars = isCustom
    ? Number.isFinite(customDollars) && customDollars > 0
      ? customDollars
      : 0
    : selected;
  const wantsToPay = dollars > 0;

  async function startDownload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/download/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, platform, amountCents: 0 }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Could not start the download.");
        setPending(false);
        return;
      }

      const data = (await res.json()) as {
        downloadUrl: string;
        filename: string;
      };
      setFilename(data.filename);

      // The file is served with Content-Disposition: attachment, so this starts
      // a download without unloading the page — which is what lets the account
      // offer appear while the transfer is already running.
      window.location.href = data.downloadUrl;

      setPending(false);
      setStep("account");
    } catch {
      setError("Could not reach the server. Check your connection.");
      setPending(false);
    }
  }

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const { error } = await signUp.email({
      name: String(form.get("name")),
      email,
      password: String(form.get("password")),
      role: String(form.get("role")) as UserRole,
    });

    setPending(false);
    if (error) {
      setError(error.message ?? "Could not create the account.");
      return;
    }
    // The user-create hook attaches the download that just happened to this
    // account, so the dashboard already knows about it.
    router.push("/dashboard");
    router.refresh();
  }

  // ── step 2: the offer ──────────────────────────────────────────────────────

  if (step === "account") {
    return (
      <div className={styles.panel}>
        <div className={styles.downloadingNote}>
          <p className={styles.downloadingTitle}>Your download has started</p>
          <p className={styles.downloadingBody}>
            {filename ? (
              <>
                Saving <strong>{filename}</strong>. If nothing happened,{" "}
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => setStep("form")}
                >
                  try again
                </button>
                .
              </>
            ) : (
              "Check your downloads folder."
            )}
          </p>
        </div>

        <div className={styles.divider} />

        <h2 className={styles.panelTitle}>Want an account?</h2>
        <p className={styles.panelBody}>
          Optional, and nothing about Scamp is locked behind it. An account keeps
          your downloads in one place and gets you Scamp Cloud when it launches.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <form className={styles.form} onSubmit={createAccount}>
          <label className={styles.label}>
            Email
            <input
              className={`${styles.input} ${styles.inputLocked}`}
              value={email}
              readOnly
              aria-describedby="email-note"
            />
          </label>
          <p id="email-note" className={styles.hint}>
            The address you just downloaded with.
          </p>

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
            <select className={styles.select} name="role" required defaultValue="">
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
      </div>
    );
  }

  // ── step 1: email, platform, amount ────────────────────────────────────────

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>Download Scamp</h2>
      <p className={styles.panelBody}>
        Free, with no feature limits and no account needed. Pay what you want if
        it is useful to you.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <form className={styles.form} onSubmit={startDownload}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Platform</legend>
          <div className={styles.platformRow}>
            {PLATFORMS.map(({ slug, label, Icon }) => (
              <button
                key={slug}
                type="button"
                role="radio"
                aria-checked={platform === slug}
                onClick={() => setPlatform(slug)}
                className={`${styles.platformBtn} ${
                  platform === slug ? styles.platformBtnOn : ""
                }`}
              >
                <Icon className={styles.icon} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className={styles.label}>
          Email
          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Pay what you want</legend>
          <div className={styles.amountRow}>
            {SUGGESTED_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                role="radio"
                aria-checked={!isCustom && selected === amount}
                onClick={() => setSelected(amount)}
                className={`${styles.amountBtn} ${
                  !isCustom && selected === amount ? styles.amountBtnOn : ""
                }`}
              >
                ${amount}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={isCustom}
              onClick={() => setSelected(-1)}
              className={`${styles.amountBtn} ${isCustom ? styles.amountBtnOn : ""}`}
            >
              Custom
            </button>
          </div>

          {isCustom && (
            <label className={styles.customWrap}>
              <span className={styles.customPrefix}>$</span>
              <input
                type="number"
                min="0"
                max={MAX_PAID_CENTS / 100}
                step="1"
                inputMode="decimal"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className={styles.customInput}
                aria-label="Custom amount in dollars"
              />
            </label>
          )}
        </fieldset>

        {wantsToPay && (
          <p className={styles.hint}>
            Card payments are not switched on yet, so nothing can be charged
            today. Download now and come back to pay when it is ready.
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? "Starting…" : "Download Scamp"}
        </button>
      </form>

      <p className={styles.skip}>
        Already have an account?{" "}
        <Link href="/sign-in" className={styles.link}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
