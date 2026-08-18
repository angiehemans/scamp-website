"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import styles from "../auth.module.css";

export default function SignUpPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const { error } = await signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    setPending(false);
    if (error) {
      setError(error.message ?? "Could not create the account.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create an account</h1>

        {error && <p className={styles.error}>{error}</p>}

        <form className={styles.form} onSubmit={onSubmit}>
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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button className={styles.button} type="submit" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className={styles.meta}>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
