import styles from "./Download.module.css";

export default function Download() {
  return (
    <section id="download" className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.headline}>Download Scamp.</h2>
        <p className={styles.sub}>Free and open source. No account required.</p>

        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.icon} aria-hidden="true"></span>
              <h3 className={styles.cardTitle}>macOS</h3>
            </div>
            <p className={styles.cardMeta}>
              Apple Silicon
              <br />
              macOS 12+
            </p>
            <div className={styles.cardCtas}>
              <span className={styles.dlBtn} aria-disabled="true">
                Coming soon
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.icon} aria-hidden="true">
                ⊞
              </span>
              <h3 className={styles.cardTitle}>Windows</h3>
            </div>
            <p className={styles.cardMeta}>
              Windows 10+
              <br />
              x64
            </p>
            <div className={styles.cardCtas}>
              <span className={styles.dlBtn} aria-disabled="true">
                Coming soon
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.icon} aria-hidden="true">
                🐧
              </span>
              <h3 className={styles.cardTitle}>Linux</h3>
            </div>
            <p className={styles.cardMeta}>
              .deb / .AppImage
              <br />
              x64
            </p>
            <div className={styles.cardCtas}>
              <span className={styles.dlBtn} aria-disabled="true">
                Coming soon
              </span>
            </div>
          </div>
        </div>

        <p className={styles.meta}>
          v1.0.0 · <a href="#">Release notes</a> ·{" "}
          <a
            href="https://github.com/angiehemans/scamp"
            target="_blank"
            rel="noreferrer"
          >
            View source on GitHub ↗
          </a>
        </p>

        <div className={styles.sourceBlock}>
          <p className={styles.sourceLabel}>Or build from source:</p>
          <pre className={styles.code}>
            <code>
              {`git clone https://github.com/angiehemans/scamp
cd scamp && npm install && npm run build`}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
