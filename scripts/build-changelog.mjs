// Reads content/changelog/*.md and writes lib/changelog.generated.json.
// Runs before `dev` and `build` so the page can import static data
// instead of touching the filesystem at request time.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const contentDir = path.join(root, "content", "changelog");
const outPath = path.join(root, "lib", "changelog.generated.json");

const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));

const entries = files.map((filename) => {
  const raw = fs.readFileSync(path.join(contentDir, filename), "utf-8");
  const { data, content } = matter(raw);
  return {
    version: data.version ?? "",
    title: data.title ?? null,
    description: data.description ?? null,
    order: typeof data.order === "number" ? data.order : 0,
    content,
  };
});

entries.sort((a, b) => b.order - a.order);

fs.writeFileSync(outPath, JSON.stringify(entries, null, 2) + "\n");
console.log(
  `build-changelog: wrote ${entries.length} entries to ${path.relative(root, outPath)}`,
);
