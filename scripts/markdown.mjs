// Build-time markdown -> HTML renderer shared by build-changelog.mjs and
// build-docs.mjs. Rendering happens once at build, not per request, so the
// pages can inject a precomputed HTML string instead of running react-markdown
// in the Cloudflare Worker on every page load.
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const BADGE_VALUES = new Set(["shipped", "to-do", "upcoming"]);

// Minimal hast walker — avoids pulling in unist-util-visit.
function visitElements(node, tagName, fn) {
  if (!node) return;
  if (node.type === "element" && node.tagName === tagName) fn(node);
  if (node.children) {
    for (const child of node.children) visitElements(child, tagName, fn);
  }
}

function textOf(node) {
  if (node.type === "text") return node.value;
  if (node.children) return node.children.map(textOf).join("");
  return "";
}

// Rewrites doc-relative `.md` links to `/docs/<slug>` and opens external
// links in a new tab — mirrors the old MarkdownContent link component.
function rehypeDocLinks() {
  return (tree) => {
    visitElements(tree, "a", (node) => {
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      if (/\.md(#.*)?$/.test(href)) {
        const [file, hash] = href.split("#");
        const slug = file.replace(/\.md$/, "");
        node.properties.href = `/docs/${slug}${hash ? `#${hash}` : ""}`;
        return;
      }
      if (/^https?:/.test(href)) {
        node.properties.target = "_blank";
        node.properties.rel = "noreferrer";
      }
    });
  };
}

// Turns inline `shipped` / `to-do` / `upcoming` code spans into status badges,
// mirroring the old Badge component in the changelog page.
function rehypeChangelogBadges() {
  return (tree) => {
    visitElements(tree, "code", (node) => {
      const text = textOf(node).trim();
      if (!BADGE_VALUES.has(text)) return;
      node.tagName = "span";
      node.properties = { className: ["badge", `badge-${text}`] };
      node.children = [{ type: "text", value: text }];
    });
  };
}

export function renderDocHtml(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeDocLinks)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

export function renderChangelogHtml(markdown) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeChangelogBadges)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}
