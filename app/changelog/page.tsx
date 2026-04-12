import type { Metadata } from "next";
import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import { getChangelogEntries } from "@/lib/changelog";
import styles from "./changelog.module.css";

export const metadata: Metadata = {
  title: "Changelog — Scamp",
  description:
    "What's new in Scamp. Release history and upcoming features for the local-first design tool for developers.",
};

function Badge({ type }: { type: "shipped" | "to-do" }) {
  return (
    <span
      className={`${styles.badge} ${type === "shipped" ? styles.badgeShipped : styles.badgeTodo}`}
    >
      {type === "shipped" ? "shipped" : "to-do"}
    </span>
  );
}

const badgeValues = new Set(["shipped", "to-do"]);

const mdComponents: Components = {
  h3({ children }) {
    return <h3 className={styles.featureTitle}>{children}</h3>;
  },
  ul({ children }) {
    return <ul className={styles.list}>{children}</ul>;
  },
  code({ children }) {
    const text = String(children).trim();
    if (badgeValues.has(text)) {
      return <Badge type={text as "shipped" | "to-do"} />;
    }
    return <code>{children}</code>;
  },
};

export default function ChangelogPage() {
  const entries = getChangelogEntries();

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <h1 className={styles.title}>Changelog</h1>
            <p className={styles.subtitle}>
              What&apos;s new and what&apos;s next for Scamp.
            </p>
          </header>

          {entries.map((entry) => (
            <section key={entry.version} className={styles.release}>
              <h2 className={styles.version}>
                {entry.version}
                {entry.title ? ` — ${entry.title}` : ""}
              </h2>
              {entry.description && (
                <p className={styles.versionSub}>{entry.description}</p>
              )}
              <Markdown components={mdComponents}>{entry.content}</Markdown>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
