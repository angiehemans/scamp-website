import type { Metadata } from "next";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import BookDemo from "@/components/BookDemo/BookDemo";
import { getChangelogEntries } from "@/lib/changelog";
import styles from "./changelog.module.css";

// Formatted at render with an explicit UTC zone so the date never shifts a
// day depending on where the worker runs.
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: string) {
  return DATE_FORMAT.format(new Date(`${date}T00:00:00Z`));
}

const CHANGELOG_DESCRIPTION =
  "What's new in Scamp. Release history and upcoming features for the Figma alternative for designers.";

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
              <div className={styles.versionRow}>
                <h2 className={styles.version}>
                  {entry.version}
                  {entry.title ? ` — ${entry.title}` : ""}
                </h2>
                {entry.date && (
                  <time className={styles.date} dateTime={entry.date}>
                    {formatDate(entry.date)}
                  </time>
                )}
              </div>
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
      <BookDemo />
      <Footer />
    </>
  );
}
