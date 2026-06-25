// Data is precompiled from content/docs/*.md by scripts/build-docs.mjs
// and imported as JSON so the page has no filesystem dependency at runtime.
import data from "./docs.generated.json";

export interface DocEntry {
  slug: string;
  title: string;
  description: string | null;
  order: number;
  /** Precompiled at build time by scripts/build-docs.mjs. */
  html: string;
}

/** Doc metadata without the heavy precompiled `html`, for nav/listing UI. */
export type DocNavEntry = Omit<DocEntry, "html">;

interface DocsData {
  index: DocEntry | null;
  entries: DocEntry[];
}

/**
 * Navigation/listing metadata only — deliberately excludes `html`. The sidebar
 * is a Client Component, so anything returned here is serialized into the RSC
 * payload of every docs page; returning the full HTML would embed all docs in
 * each page. Use getDocBySlug/getDocIndex when the rendered HTML is needed.
 */
export function getDocEntries(): DocNavEntry[] {
  return (data as DocsData).entries.map(({ html: _html, ...rest }) => rest);
}

export function getDocIndex(): DocEntry | null {
  return (data as DocsData).index;
}

export function getDocBySlug(slug: string): DocEntry | null {
  return (data as DocsData).entries.find((e) => e.slug === slug) ?? null;
}
