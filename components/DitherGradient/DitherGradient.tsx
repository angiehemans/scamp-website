import styles from "./DitherGradient.module.css";

export type DitherVariant =
  | "bottom"
  | "topFade"
  | "topRight"
  | "topCenter"
  | "bottomLeft"
  | "bottomCenter"
  | "accentTopCenter";

/**
 * A grainy dithered gradient layer, same technique as the hero: grayscale
 * noise, a color-dodged glow (the grain), and a color-burn pass. Masked so it
 * fades into the section background. Render as the first child of a
 * `position: relative` section, with the section's content lifted above it.
 */
export default function DitherGradient({
  variant = "bottom",
}: {
  variant?: DitherVariant;
}) {
  return (
    <div className={`${styles.layer} ${styles[variant]}`} aria-hidden="true" />
  );
}
