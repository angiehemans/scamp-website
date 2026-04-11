import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.cols}>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Scamp</h4>
            <p className={styles.text}>
              A local design tool
              <br />
              for developers.
            </p>
            <p className={styles.text}>MIT License.</p>
          </div>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Resources</h4>
            <ul className={styles.list}>
              <li>
                <a href="#">Documentation</a>
              </li>
              <li>
                <a href="#">Changelog</a>
              </li>
              <li>
                <a href="#">Release notes</a>
              </li>
            </ul>
          </div>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Community</h4>
            <ul className={styles.list}>
              <li>
                <a
                  href="https://github.com/scamp/scamp"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/scamp/scamp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Star on GitHub ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/scamp/scamp/issues"
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
          © 2026 Scamp. Open source under the MIT License.
        </p>
      </div>
    </footer>
  );
}
