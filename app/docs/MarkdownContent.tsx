import Link from "next/link";
import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import styles from "./docs.module.css";

const mdComponents: Components = {
  a({ href, children, ...rest }) {
    if (!href) return <a {...rest}>{children}</a>;
    if (/\.md(#.*)?$/.test(href)) {
      const [file, hash] = href.split("#");
      const slug = file.replace(/\.md$/, "");
      const target = `/docs/${slug}${hash ? `#${hash}` : ""}`;
      return <Link href={target}>{children}</Link>;
    }
    if (/^https?:/.test(href)) {
      return (
        <a href={href} target="_blank" rel="noreferrer" {...rest}>
          {children}
        </a>
      );
    }
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
};

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className={styles.prose}>
      <Markdown components={mdComponents}>{content}</Markdown>
    </div>
  );
}
