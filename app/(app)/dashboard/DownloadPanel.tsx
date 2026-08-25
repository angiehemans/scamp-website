import {
  IconBrandApple,
  IconBrandWindows,
  IconBrandDebian,
} from "@tabler/icons-react";
import styles from "./dashboard.module.css";

/**
 * Platform buttons on the dashboard.
 *
 * Plain links, and deliberately not a client component: a signed-in user has
 * already told us who they are, so there is nothing to ask and nothing to
 * submit. The download route reads the session and presigns.
 *
 * The pay-what-you-want prompt that used to live here is on the
 * `pay-what-you-want` branch, held back until Stripe is switched on. Shipping
 * an amount picker whose only working option is $0 asks a question we cannot
 * yet act on.
 */

const ICONS = {
  macos: IconBrandApple,
  windows: IconBrandWindows,
  linux: IconBrandDebian,
} as const;

export interface DownloadPanelProps {
  platforms: { slug: string; label: string; available: boolean }[];
}

export default function DownloadPanel({ platforms }: DownloadPanelProps) {
  return (
    <div className={styles.downloadGrid}>
      {platforms.map(({ slug, label, available }) => {
        const Icon = ICONS[slug as keyof typeof ICONS];
        // A platform with no build in this release is shown disabled rather
        // than hidden, so a missing macOS build reads as "not this time"
        // instead of "unsupported".
        return available ? (
          <a
            key={slug}
            href={`/api/download/${slug}`}
            className={styles.downloadBtn}
          >
            {Icon && <Icon className={styles.icon} aria-hidden="true" />}
            {label}
          </a>
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
