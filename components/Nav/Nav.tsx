import styles from "./Nav.module.css";

export default function Nav() {
  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <a href="#" className={styles.logo}>
          [] Scamp
        </a>
        <nav className={styles.links}>
          <a
            href="https://github.com/angiehemans/scamp"
            target="_blank"
            rel="noreferrer"
            className={styles.ghLink}
          >
            GitHub
            <span className={styles.arrow} aria-hidden="true">
              ↗
            </span>
          </a>
          <a
            href="https://angiehemans.gumroad.com/l/scamp"
            target="_blank"
            rel="noreferrer"
            className={styles.downloadBtn}
          >
            Download Now
          </a>
        </nav>
      </div>
    </header>
  );
}
