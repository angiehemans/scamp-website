"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocEntry } from "@/lib/docs";
import styles from "./docs.module.css";

export default function Sidebar({ entries }: { entries: DocEntry[] }) {
  const pathname = usePathname();
  const activeSlug = pathname === "/docs" ? "" : pathname.replace(/^\/docs\//, "");

  return (
    <aside className={styles.sidebar}>
      <p className={styles.sidebarLabel}>Documentation</p>
      <ul className={styles.sidebarList}>
        <li>
          <Link
            href="/docs"
            className={`${styles.sidebarLink} ${activeSlug === "" ? styles.sidebarLinkActive : ""}`}
          >
            Overview
          </Link>
        </li>
        {entries.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`/docs/${entry.slug}`}
              className={`${styles.sidebarLink} ${activeSlug === entry.slug ? styles.sidebarLinkActive : ""}`}
            >
              {entry.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
