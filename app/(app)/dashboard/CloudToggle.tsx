"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

/**
 * The admin switch for Scamp Cloud. Only rendered for admins — the route it
 * calls 404s for everyone else, so this is convenience, not the access control.
 *
 * Posts, then refreshes the server-rendered page rather than tracking the new
 * state locally: the panel's badge, copy and border all derive from the
 * database row, and one source of truth beats keeping a copy in sync.
 */
export default function CloudToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  return (
    <div className={styles.cloudControls}>
      <button
        className={styles.downloadBtn}
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          try {
            const res = await fetch("/api/account/cloud", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enabled: !enabled }),
            });
            if (!res.ok) throw new Error(String(res.status));
            setState("idle");
            router.refresh();
          } catch {
            setState("failed");
          }
        }}
      >
        {state === "busy"
          ? "Switching…"
          : enabled
            ? "Switch off Cloud"
            : "Switch on Cloud"}
      </button>
      {state === "failed" && (
        <span className={styles.fineprint}>
          Could not save. Try again in a moment.
        </span>
      )}
    </div>
  );
}
