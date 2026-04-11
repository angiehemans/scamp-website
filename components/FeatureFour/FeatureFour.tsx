import styles from "./FeatureFour.module.css";

export default function FeatureFour() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>Local-first</p>
          <h2 className={styles.headline}>
            No cloud. No account.
            <br />
            Just a folder.
          </h2>
          <p className={styles.body}>
            Scamp saves to wherever you tell it. Put your project inside an
            existing git repo, a client folder, or anywhere on your machine.
            Every page is just a TSX file and a CSS Modules file. You can open
            them in VS Code, commit them to GitHub, hand them to a teammate,
            or ship them directly — no export, no lock-in.
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Works with git</h3>
            <p className={styles.cardBody}>
              Your project is a real folder. Commit, branch, and PR like
              normal.
            </p>
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>No account needed</h3>
            <p className={styles.cardBody}>
              Download and open a project. That&apos;s it. No login, no
              subscription.
            </p>
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Standard file format</h3>
            <p className={styles.cardBody}>
              TSX and CSS Modules. Nothing proprietary, nothing custom.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
