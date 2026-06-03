import type { Metadata } from "next";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import { getChangelogEntries } from "@/lib/changelog";
import styles from "./changelog.module.css";

const CHANGELOG_DESCRIPTION =
  "What's new in Scamp. Release history and upcoming features for the open-source Figma alternative for designers.";

export const metadata: Metadata = {
  title: "Changelog",
  description: CHANGELOG_DESCRIPTION,
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog — Scamp",
    description: CHANGELOG_DESCRIPTION,
    url: "/changelog",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Changelog — Scamp",
    description: CHANGELOG_DESCRIPTION,
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
              <div
                className={styles.entryBody}
                dangerouslySetInnerHTML={{ __html: entry.html }}
              />
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
