// Data is precompiled from content/changelog/*.md by scripts/build-changelog.mjs
// and imported as JSON so the page has no filesystem dependency at runtime.
import entries from "./changelog.generated.json";

export interface ChangelogEntry {
  version: string;
  title: string | null;
  description: string | null;
  order: number;
  content: string;
}

export function getChangelogEntries(): ChangelogEntry[] {
  return entries as ChangelogEntry[];
}
