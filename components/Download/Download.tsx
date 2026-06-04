import Link from "next/link";
import {
  IconBrandApple,
  IconBrandWindows,
  IconBrandDebian,
} from "@tabler/icons-react";
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
              <IconBrandApple className={styles.icon} aria-hidden="true" />
              <h3 className={styles.cardTitle}>macOS</h3>
            </div>
            <p className={styles.cardMeta}>
              Apple Silicon
              <br />
              macOS 12+
            </p>
            <div className={styles.cardCtas}>
              <a
                href="https://angiehemans.gumroad.com/l/scamp"
                target="_blank"
                rel="noreferrer"
                className={styles.dlBtn}
              >
                Download Now
              </a>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <IconBrandWindows className={styles.icon} aria-hidden="true" />
              <h3 className={styles.cardTitle}>Windows</h3>
            </div>
            <p className={styles.cardMeta}>
              Windows 10+
              <br />
              x64
            </p>
            <div className={styles.cardCtas}>
              <a
                href="https://angiehemans.gumroad.com/l/scamp"
                target="_blank"
                rel="noreferrer"
                className={styles.dlBtn}
              >
                Download Now
              </a>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <IconBrandDebian className={styles.icon} aria-hidden="true" />
              <h3 className={styles.cardTitle}>Linux</h3>
            </div>
            <p className={styles.cardMeta}>
              .deb / .AppImage
              <br />
              x64
            </p>
            <div className={styles.cardCtas}>
              <a
                href="https://angiehemans.gumroad.com/l/scamp"
                target="_blank"
                rel="noreferrer"
                className={styles.dlBtn}
              >
                Download Now
              </a>
            </div>
          </div>
        </div>

        <p className={styles.meta}>
          v1.0.0 · <Link href="/changelog">Release notes</Link> ·{" "}
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
