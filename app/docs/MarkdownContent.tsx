import styles from "./docs.module.css";

// Markdown is rendered to HTML at build time by scripts/build-docs.mjs, so the
// page only injects a precomputed string here — no markdown parsing happens in
// the worker at request time.
export default function MarkdownContent({ html }: { html: string }) {
  return (
    <div className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
