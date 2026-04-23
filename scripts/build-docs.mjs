// Reads content/docs/*.md and writes lib/docs.generated.json.
// Runs before `dev` and `build` so the page can import static data
// instead of touching the filesystem at request time.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const contentDir = path.join(root, "content", "docs");
const outPath = path.join(root, "lib", "docs.generated.json");

const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));

function extractTitle(content) {
  const match = content.match(/^\s*#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function stripLeadingH1(content) {
  return content.replace(/^\s*#\s+.+(?:\r?\n)?/, "");
}

function extractDescription(content) {
  const stripped = content.replace(/^\s*#\s+.+$/m, "").trim();
  const paragraph = stripped.split(/\n\s*\n/)[0] || "";
  const oneLine = paragraph.replace(/\s+/g, " ").trim();
  if (!oneLine) return null;
  return oneLine.length > 200 ? oneLine.slice(0, 197) + "..." : oneLine;
}

function extractTocOrder(content) {
  const order = new Map();
  const re = /\[[^\]]+\]\(([^)\s#]+)\.md(?:#[^)]*)?\)/g;
  let match;
  let i = 0;
  while ((match = re.exec(content)) !== null) {
    const slug = match[1];
    if (slug === "index") continue;
    if (!order.has(slug)) order.set(slug, i++);
  }
  return order;
}

let indexEntry = null;
const entries = [];

for (const filename of files) {
  const slug = filename.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(contentDir, filename), "utf-8");
  const { data, content } = matter(raw);
  const title = data.title ?? extractTitle(content) ?? slug;
  const entry = {
    slug,
    title,
    description: data.description ?? extractDescription(content),
    explicitOrder: typeof data.order === "number" ? data.order : null,
    content: stripLeadingH1(content),
  };
  if (slug === "index") {
    entry.order = 0;
    delete entry.explicitOrder;
    indexEntry = entry;
  } else {
    entries.push(entry);
  }
}

const tocOrder = indexEntry ? extractTocOrder(indexEntry.content) : new Map();

for (const entry of entries) {
  if (entry.explicitOrder !== null) {
    entry.order = entry.explicitOrder;
  } else if (tocOrder.has(entry.slug)) {
    entry.order = tocOrder.get(entry.slug);
  } else {
    entry.order = 1000;
  }
  delete entry.explicitOrder;
}

entries.sort((a, b) => {
  if (a.order !== b.order) return a.order - b.order;
  return a.title.localeCompare(b.title);
});

const payload = { index: indexEntry, entries };
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
console.log(
  `build-docs: wrote ${entries.length} doc entries to ${path.relative(root, outPath)}`,
);
