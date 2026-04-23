import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocBySlug, getDocEntries } from "@/lib/docs";
import JsonLd from "@/components/JsonLd/JsonLd";
import { articleSchema, breadcrumbSchema } from "@/lib/schema";
import { SITE_NAME } from "@/lib/site";
import MarkdownContent from "../MarkdownContent";
import styles from "../docs.module.css";

export function generateStaticParams() {
  return getDocEntries().map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) return { title: "Not found" };
  const canonical = `/docs/${doc.slug}`;
  return {
    title: `${doc.title} — Scamp Docs`,
    description: doc.description ?? undefined,
    alternates: { canonical },
    openGraph: {
      title: `${doc.title} — ${SITE_NAME} Docs`,
      description: doc.description ?? undefined,
      url: canonical,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${doc.title} — ${SITE_NAME} Docs`,
      description: doc.description ?? undefined,
    },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  const entries = getDocEntries();
  const index = entries.findIndex((e) => e.slug === slug);
  const prev = index > 0 ? entries[index - 1] : null;
  const next = index >= 0 && index < entries.length - 1 ? entries[index + 1] : null;

  return (
    <>
      <header className={styles.header}>
        <p className={styles.breadcrumb}>
          <Link href="/docs">Documentation</Link>
        </p>
        <h1 className={styles.title}>{doc.title}</h1>
        {doc.description && <p className={styles.subtitle}>{doc.description}</p>}
      </header>

      <MarkdownContent content={doc.content} />

      {(prev || next) && (
        <nav className={styles.pager}>
          {prev ? (
            <Link href={`/docs/${prev.slug}`} className={styles.pagerLink}>
              <span className={styles.pagerLabel}>← Previous</span>
              <span className={styles.pagerTitle}>{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/docs/${next.slug}`}
              className={`${styles.pagerLink} ${styles.pagerNext}`}
            >
              <span className={styles.pagerLabel}>Next →</span>
              <span className={styles.pagerTitle}>{next.title}</span>
            </Link>
          )}
        </nav>
      )}

      <JsonLd
        data={[
          articleSchema({
            title: doc.title,
            description: doc.description,
            url: `/docs/${doc.slug}`,
          }),
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Documentation", url: "/docs" },
            { name: doc.title, url: `/docs/${doc.slug}` },
          ]),
        ]}
      />
    </>
  );
}
