import type { Metadata } from "next";
import Link from "next/link";
import { getDocEntries, getDocIndex } from "@/lib/docs";
import MarkdownContent from "./MarkdownContent";
import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "Documentation — Scamp",
  description:
    "Learn how to use Scamp, the local-first design tool that generates real TSX and CSS Module files.",
};

export default function DocsLandingPage() {
  const entries = getDocEntries();
  const index = getDocIndex();

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{index?.title ?? "Documentation"}</h1>
        {/* {index?.description && <p className={styles.subtitle}>{index.description}</p>} */}
      </header>

      {index?.content && <MarkdownContent content={index.content} />}

      <div className={styles.grid}>
        {entries.map((entry) => (
          <Link key={entry.slug} href={`/docs/${entry.slug}`} className={styles.card}>
            <span className={styles.cardTitle}>{entry.title}</span>
            {entry.description && (
              <span className={styles.cardDesc}>{entry.description}</span>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
