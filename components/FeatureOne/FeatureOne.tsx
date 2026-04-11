import Image from "next/image";
import styles from "./FeatureOne.module.css";

export default function FeatureOne() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.text}>
          <p className={styles.eyebrow}>Real output</p>
          <h2 className={styles.headline}>Your design is the code.</h2>
          <p className={styles.body}>
            Every rectangle you draw becomes a real div. Every style you set
            becomes a real CSS class. Scamp doesn&apos;t export or compile, it
            just writes files. Open your project in any editor and the code is
            already there, exactly as you&apos;d write it yourself.
          </p>
        </div>
        <div className={styles.screenshot}>
          <Image
            src="/scamp-code.png"
            alt="Scamp with the code panel open, showing the generated TSX and CSS Modules files for the current design"
            width={2805}
            height={1690}
            sizes="(max-width: 900px) 100vw, 680px"
          />
        </div>
      </div>
    </section>
  );
}
