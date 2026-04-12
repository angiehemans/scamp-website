import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface ChangelogEntry {
  version: string;
  title?: string;
  description?: string;
  order: number;
  content: string;
}

const changelogDir = path.join(process.cwd(), "content", "changelog");

export function getChangelogEntries(): ChangelogEntry[] {
  const files = fs
    .readdirSync(changelogDir)
    .filter((f) => f.endsWith(".md"));

  const entries = files.map((filename) => {
    const raw = fs.readFileSync(path.join(changelogDir, filename), "utf-8");
    const { data, content } = matter(raw);

    return {
      version: data.version as string,
      title: (data.title as string) || undefined,
      description: (data.description as string) || undefined,
      order: (data.order as number) || 0,
      content,
    };
  });

  return entries.sort((a, b) => b.order - a.order);
}
