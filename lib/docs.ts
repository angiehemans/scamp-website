// Data is precompiled from content/docs/*.md by scripts/build-docs.mjs
// and imported as JSON so the page has no filesystem dependency at runtime.
import data from "./docs.generated.json";

export interface DocEntry {
  slug: string;
  title: string;
  description: string | null;
  order: number;
  content: string;
}

interface DocsData {
  index: DocEntry | null;
  entries: DocEntry[];
}

export function getDocEntries(): DocEntry[] {
  return (data as DocsData).entries;
}

export function getDocIndex(): DocEntry | null {
  return (data as DocsData).index;
}

export function getDocBySlug(slug: string): DocEntry | null {
  return (data as DocsData).entries.find((e) => e.slug === slug) ?? null;
}
