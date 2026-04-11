import Image from "next/image";
import styles from "./FeatureThree.module.css";

export default function FeatureThree() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>Built-in terminal</p>
          <h2 className={styles.headline}>
            Run your agent.
            <br />
            Right here.
          </h2>
          <p className={styles.body}>
            Scamp has a built-in terminal that opens in your project folder.
            Run Claude Code, Aider, or any coding agent you already use. The
            agent reads your project&apos;s instructions file, edits your
            layout files, and Scamp reloads the canvas automatically. No
            copy-pasting. No context switching.
          </p>
        </div>

        <div className={styles.screenshot}>
          <Image
            src="/scamp-terminal.png"
            alt="Scamp with the built-in terminal panel open at the bottom, ready to run a coding agent in the project folder"
            width={2805}
            height={1690}
            sizes="(max-width: 1100px) 100vw, 1000px"
          />
        </div>

        <div className={styles.callouts}>
          <div className={styles.callout}>
            <h3 className={styles.calloutTitle}>Opens in your project folder</h3>
            <p className={styles.calloutBody}>
              No setup. The terminal starts in the right place every time.
            </p>
          </div>
          <div className={styles.callout}>
            <h3 className={styles.calloutTitle}>Reads agent.md automatically</h3>
            <p className={styles.calloutBody}>
              Your project conventions are always in the agent&apos;s context.
            </p>
          </div>
          <div className={styles.callout}>
            <h3 className={styles.calloutTitle}>Canvas reloads on every save</h3>
            <p className={styles.calloutBody}>
              Agent edits show up on the canvas without touching it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
