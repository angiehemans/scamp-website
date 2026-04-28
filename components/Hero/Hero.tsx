import Image from "next/image";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.bgGradient} aria-hidden="true" />
      <div className={styles.inner}>
        <p className={styles.eyebrow}>
          For designers · Open source · Local-first
        </p>
        <h1 className={styles.headline}>Design to code. No handoff.</h1>
        <p className={styles.sub}>
          Scamp is a local-first UI design tool for designers and developers. Every change saves as real TSX and CSS Modules files you can commit, run, and hand to a coding agent.
        </p>
        <div className={styles.ctas}>
          <a
            href="https://angiehemans.gumroad.com/l/scamp"
            target="_blank"
            rel="noreferrer"
            className={styles.primaryCta}
          >
            Download Now
          </a>
          <a
            href="https://github.com/angiehemans/scamp"
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
