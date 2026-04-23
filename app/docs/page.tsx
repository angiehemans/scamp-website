import type { Metadata } from "next";
import Link from "next/link";
import { getDocEntries, getDocIndex } from "@/lib/docs";
import JsonLd from "@/components/JsonLd/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { SITE_NAME } from "@/lib/site";
import MarkdownContent from "./MarkdownContent";
import styles from "./docs.module.css";

const DOCS_DESCRIPTION =
  "Documentation for Scamp, the open-source Figma alternative for designers. Learn the canvas, visual and CSS controls, breakpoints, theme tokens, AI coding agent workflows, and how to hand off real TSX and CSS Module files.";

export const metadata: Metadata = {
  title: "Documentation",
  description: DOCS_DESCRIPTION,
  alternates: { canonical: "/docs" },
  openGraph: {
    title: `Documentation — ${SITE_NAME}`,
    description: DOCS_DESCRIPTION,
    url: "/docs",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Documentation — ${SITE_NAME}`,
    description: DOCS_DESCRIPTION,
  },
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
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Documentation", url: "/docs" },
        ])}
      />
    </>
  );
}
