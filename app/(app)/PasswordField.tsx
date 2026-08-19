"use client";

import { useId, useState } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import styles from "./auth.module.css";

/**
 * A password input with a show/hide toggle.
 *
 * Notes for anyone changing this:
 *
 * - The toggle is `type="button"`. Inside a form, a button without an explicit
 *   type defaults to `submit`, so omitting it would submit the form every time
 *   someone tried to peek at their password.
 * - The accessible name changes with state ("Show password" / "Hide password")
 *   and `aria-pressed` reflects it, so screen reader users can tell whether
 *   their password is currently on screen.
 * - The button is deliberately reachable by keyboard rather than
 *   `tabIndex={-1}`. Someone typing a long password by hand is exactly who
 *   needs to check it.
 * - `autoComplete` stays on the input in both states so password managers keep
 *   working when the field is revealed.
 */
export default function PasswordField({
  name = "password",
  label = "Password",
  autoComplete,
  minLength,
  required = true,
}: {
  name?: string;
  label?: string;
  autoComplete: "new-password" | "current-password";
  minLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className={styles.label}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWrap}>
        <input
          id={id}
          className={`${styles.input} ${styles.inputWithButton}`}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className={styles.revealButton}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <IconEyeOff size={18} aria-hidden="true" />
          ) : (
            <IconEye size={18} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
