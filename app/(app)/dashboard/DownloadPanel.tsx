"use client";

import { useState } from "react";
import {
  IconBrandApple,
  IconBrandWindows,
  IconBrandDebian,
} from "@tabler/icons-react";
import { SUGGESTED_AMOUNTS, MAX_PAID_CENTS } from "@/lib/purchase-status";
import styles from "./dashboard.module.css";

/**
 * Platform buttons, and the pay-what-you-want prompt behind them.
 *
 * Two states, decided on the server by whether this account has already
 * answered:
 *
 *   asked already → plain download links, no prompt. Paying is a one-time
 *                   question; re-asking on every download is nagging.
 *   not yet       → clicking a platform opens the amount picker.
 *
 * The prompt is not a paywall. $0 is a first-class choice, sits first in the
 * list, and needs no more clicks than paying does. Hiding it or making it
 * awkward would turn "pay what you want" into a dark pattern, and would also
 * contradict the "free forever" promise on the pricing page.
 */

const PLATFORM_ICONS = {
  macos: IconBrandApple,
  windows: IconBrandWindows,
  linux: IconBrandDebian,
} as const;

export interface DownloadPanelProps {
  platforms: { slug: string; label: string; available: boolean }[];
  /** True once this account has chosen $0 or paid. Suppresses the prompt. */
  alreadyResponded: boolean;
}

type Phase = "idle" | "choosing" | "working";

export default function DownloadPanel({
  platforms,
  alreadyResponded,
}: DownloadPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [platform, setPlatform] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(SUGGESTED_AMOUNTS[0]);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isCustom = selected === -1;
  const customDollars = Number(custom);
  const customValid =
    custom.trim() !== "" &&
    Number.isFinite(customDollars) &&
    customDollars >= 0 &&
    customDollars * 100 <= MAX_PAID_CENTS;

  // Phase 1 ships the $0 path only; Stripe arrives in Phase 2. Anything above
  // zero is therefore not yet actionable, and the button says so rather than
  // failing after the click.
  const dollars = isCustom ? (customValid ? customDollars : 0) : selected;
  const wantsToPay = dollars > 0;

  function open(slug: string) {
    setPlatform(slug);
    setError(null);
    if (alreadyResponded) {
      window.location.href = `/api/download/${slug}`;
      return;
    }
    setPhase("choosing");
  }

  async function claimFree() {
    if (!platform) return;
    setPhase("working");
    setError(null);
    try {
      const res = await fetch("/api/download/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, amountCents: 0 }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? "Could not start the download.");
        setPhase("choosing");
        return;
      }
      const { downloadUrl } = (await res.json()) as { downloadUrl: string };
      // Full navigation, not fetch: the browser has to handle the file.
      window.location.href = downloadUrl;
    } catch {
      setError("Could not reach the server. Check your connection.");
      setPhase("choosing");
    }
  }

  if (phase === "idle" || !platform) {
    return (
      <div className={styles.downloadGrid}>
        {platforms.map(({ slug, label, available }) => {
          const Icon = PLATFORM_ICONS[slug as keyof typeof PLATFORM_ICONS];
          return available ? (
            <button
              key={slug}
              type="button"
              onClick={() => open(slug)}
              className={styles.downloadBtn}
            >
              {Icon && <Icon className={styles.icon} aria-hidden="true" />}
              {label}
            </button>
          ) : (
            <span
              key={slug}
              className={`${styles.downloadBtn} ${styles.downloadBtnOff}`}
              aria-disabled="true"
            >
              {Icon && <Icon className={styles.icon} aria-hidden="true" />}
              {label}
            </span>
          );
        })}
      </div>
    );
  }

  const label = platforms.find((p) => p.slug === platform)?.label ?? platform;

  return (
    <div className={styles.pwyw}>
      <div className={styles.pwywHead}>
        <p className={styles.pwywTitle}>Pay what you want for {label}</p>
        <p className={styles.pwywBody}>
          Scamp is free, and $0 is a real option. If it is useful to you, paying
          something funds the work.
        </p>
      </div>

      <div
        className={styles.amountRow}
        role="radiogroup"
        aria-label="Amount to pay"
      >
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
            autoFocus
          />
        </label>
      )}

      {error && <p className={styles.pwywError}>{error}</p>}

      <div className={styles.pwywActions}>
        {wantsToPay ? (
          <button type="button" className={styles.pwywPay} disabled>
            Card payment coming soon
          </button>
        ) : (
          <button
            type="button"
            className={styles.pwywPay}
            onClick={claimFree}
            disabled={phase === "working"}
          >
            {phase === "working" ? "Starting…" : `Download ${label}`}
          </button>
        )}

        {/* Selecting an amount must never trap someone. Until Stripe is wired
            up the pay button is dead, so the free route stays one click away
            rather than requiring them to work out that "Back" then "$0" is the
            way through. */}
        {wantsToPay && (
          <button
            type="button"
            className={styles.pwywCancel}
            onClick={claimFree}
            disabled={phase === "working"}
          >
            {phase === "working" ? "Starting…" : "Download without paying"}
          </button>
        )}

        <button
          type="button"
          className={styles.pwywCancel}
          onClick={() => {
            setPhase("idle");
            setPlatform(null);
          }}
        >
          Back
        </button>
      </div>

      {wantsToPay && (
        <p className={styles.fineprint}>
          Card payments are not switched on yet, so nothing can be charged today.
          Download now and come back to pay whenever it is ready.
        </p>
      )}
    </div>
  );
}
