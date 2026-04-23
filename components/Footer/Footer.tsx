import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.cols}>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Scamp</h4>
            <p className={styles.text}>
              A Figma alternative
              <br />
              for designers.
            </p>
            <p className={styles.text}>BSL License.</p>
          </div>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Product</h4>
            <ul className={styles.list}>
              <li>
                <a href="/figma-alternative">Figma alternative</a>
              </li>
              <li>
                <a href="/docs">Documentation</a>
              </li>
              <li>
                <a href="/changelog">Changelog</a>
              </li>
              <li>
                <a href="/faq">FAQ</a>
              </li>
              <li>
                <a href="/trust">Trust & data</a>
              </li>
            </ul>
          </div>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Community</h4>
            <ul className={styles.list}>
              <li>
                <a
                  href="https://github.com/angiehemans/scamp"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/angiehemans/scamp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Star on GitHub ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/angiehemans/scamp/issues"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open an issue ↗
                </a>
              </li>
            </ul>
          </div>
        </div>
        <p className={styles.copyright}>
          © 2026 Scamp. Open source under BSL License.
        </p>
      </div>
    </footer>
  );
}
