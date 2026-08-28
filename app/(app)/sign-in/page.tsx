"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import DitherGradient from "@/components/DitherGradient/DitherGradient";
import { useDesktopHandoff } from "../useDesktopHandoff";
import styles from "../auth.module.css";

export default function SignInPage() {
  const router = useRouter();
  const desktop = useDesktopHandoff();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const { error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    setPending(false);
    if (error) {
      setError(error.message ?? "Could not sign in.");
      return;
    }
    // A desktop sign-in ends at the app's callback, not our dashboard.
    if (desktop.active) {
      const failure = await desktop.complete();
      if (failure) {
        setError(failure);
        return;
      }
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className={styles.main}>
      <DitherGradient variant="centerBlue" />
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>

        {error && <p className={styles.error}>{error}</p>}

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className={styles.button} type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className={styles.meta}>
          No account yet? <Link href="/sign-up">Create one</Link>
        </p>
      </div>
    </main>
  );
}
