import Image from "next/image";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.bgGradient} aria-hidden="true" />
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Open source · Free · Local-first</p>
        <h1 className={styles.headline}>
          Sketch layouts.
          <br />
          Ship real code.
        </h1>
        <p className={styles.sub}>
          Scamp is a local design tool for developers. Draw rectangles, set flex
          layouts, and style elements — your design saves as real TSX and CSS
          Modules files you actually own.
        </p>
        <div className={styles.ctas}>
          <a href="#download" className={styles.primaryCta}>
            Download for Mac
          </a>
          <a
            href="https://github.com/scamp/scamp"
            target="_blank"
            rel="noreferrer"
            className={styles.secondaryCta}
          >
            View on GitHub
            <span aria-hidden="true" className={styles.arrow}>
              ↗
            </span>
          </a>
        </div>
        <div className={styles.platforms}>
          <span className={styles.platformsLabel}>Also available for</span>
          <span className={styles.platformPill}>Windows</span>
          <span className={styles.platformPill}>Linux</span>
        </div>

        <div className={styles.visual}>
          <div className={styles.screenshot}>
            <Image
              src="/scamp.png"
              alt="Scamp app showing a layers panel, canvas with a landing page design, and the CSS inspector panel open"
              width={2805}
              height={1690}
              priority
              sizes="(max-width: 960px) 100vw, 960px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
