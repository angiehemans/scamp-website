import Image from "next/image";
import Link from "next/link";
import DitherGradient from "@/components/DitherGradient/DitherGradient";
import styles from "./FeatureTwo.module.css";

export default function FeatureTwo() {
  return (
    <section className={styles.section}>
      <DitherGradient variant="bottomCenter" />
      <div className={styles.inner}>
        <div className={styles.screenshot}>
          <Image
            src="/scamp-theme.png"
            alt="Scamp with a theme tokens modal open, editing CSS custom properties that update the canvas live"
            width={2805}
            height={1690}
            sizes="(max-width: 900px) 100vw, 680px"
          />
        </div>
        <div className={styles.text}>
          <p className={styles.eyebrow}>Theme builder</p>
          <h2 className={styles.headline}>
            Light, dark, and
            <br />
            anything you design.
          </h2>
          <p className={styles.body}>
            Define your colors once as semantic tokens, then layer Light, Dark,
            or any custom theme on top. Each theme overrides only the values
            that differ, so the rest of your palette stays shared. Preview any
            theme from the canvas toolbar and every token repaints instantly. It
            all saves as real theme.css that{" "}
            <Link href="/docs/themes">
              round-trips through your editor and AI agents
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
