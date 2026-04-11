import Image from "next/image";
import styles from "./FeatureTwo.module.css";

export default function FeatureTwo() {
  return (
    <section className={styles.section}>
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
          <p className={styles.eyebrow}>Bidirectional sync</p>
          <h2 className={styles.headline}>
            Edit code, see it live.
            <br />
            Edit visually, see the code.
          </h2>
          <p className={styles.body}>
            Scamp watches your project files. Edit the CSS in your editor, run
            a coding agent, or change a value directly in the terminal — Scamp
            picks up the change and updates the canvas instantly. No import
            step, no sync button. The files are always the source of truth.
          </p>
        </div>
      </div>
    </section>
  );
}
