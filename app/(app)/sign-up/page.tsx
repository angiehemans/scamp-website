"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { USER_ROLE_OPTIONS, type UserRole } from "@/lib/user-roles";
import PasswordField from "../PasswordField";
import DitherGradient from "@/components/DitherGradient/DitherGradient";
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
      // The select offers only these values and is `required`, and the server
      // rejects anything outside the list — so narrowing here is safe rather
      // than a bare assertion over unvalidated input.
      role: String(form.get("role")) as UserRole,
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
      <DitherGradient variant="centerBlue" />
      <div className={styles.card}>
        <h1 className={styles.title}>Create an account</h1>

        {/*
          Says what an account is actually for today, which is not much. Someone
          who signs up expecting cloud features and finds a download page has
          been misled by omission, and the honest version costs a sentence.
        */}
        <p className={styles.blurb}>
          Scamp is free and an account is optional. Right now one keeps your
          downloads in one place, and it is how you will hear first when Scamp
          Cloud launches with sharing, backup and sync.
        </p>

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
          <PasswordField autoComplete="new-password" minLength={8} />
          <label className={styles.label}>
            What do you do?
            <select className={styles.input} name="role" defaultValue="" required>
              <option value="" disabled>
                Choose one…
              </option>
              {USER_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
