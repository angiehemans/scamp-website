"use client";

import { useEffect, useState } from "react";
import styles from "./Nav.module.css";

const mobileLinks: {
  href: string;
  label: string;
  external?: boolean;
}[] = [
  { href: "/docs", label: "Docs" },
  { href: "/figma-alternative", label: "vs Figma" },
  { href: "/faq", label: "FAQ" },
  { href: "/trust", label: "Trust & data" },
  { href: "/changelog", label: "Changelog" },
  { href: "https://github.com/angiehemans/scamp", label: "GitHub ↗", external: true },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 720) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <a href="/" className={styles.logo} onClick={close}>
          [] Scamp
        </a>

        <nav className={styles.desktopLinks} aria-label="Primary">
          <a href="/docs" className={styles.link}>
            Docs
          </a>
          <a href="/figma-alternative" className={styles.link}>
            vs Figma
          </a>
          <a
            href="https://github.com/angiehemans/scamp"
            target="_blank"
            rel="noreferrer"
            className={styles.link}
          >
            GitHub
            <span className={styles.arrow} aria-hidden="true">
              ↗
            </span>
          </a>
          <a
            href="https://angiehemans.gumroad.com/l/scamp"
            target="_blank"
            rel="noreferrer"
            className={styles.downloadBtn}
          >
            Download Now
          </a>
        </nav>

        <button
          type="button"
          className={styles.menuBtn}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          onClick={() => setOpen((v) => !v)}
        >
          <span
            className={`${styles.hamburger} ${open ? styles.hamburgerOpen : ""}`}
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <div
        id="mobile-nav-panel"
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <nav className={styles.panelNav} aria-label="Mobile primary">
          {mobileLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={styles.panelLink}
              onClick={close}
              {...(link.external
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://angiehemans.gumroad.com/l/scamp"
            target="_blank"
            rel="noreferrer"
            className={styles.panelDownloadBtn}
            onClick={close}
          >
            Download Now
          </a>
        </nav>
      </div>
    </header>
  );
}
