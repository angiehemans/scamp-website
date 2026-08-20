"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import styles from "./dashboard.module.css";

export default function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      className={styles.downloadBtn}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.push("/sign-in");
        router.refresh();
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
