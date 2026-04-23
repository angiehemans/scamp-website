import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import FAQ from "@/components/FAQ/FAQ";
import JsonLd from "@/components/JsonLd/JsonLd";
import {
  softwareApplicationSchema,
  breadcrumbSchema,
} from "@/lib/schema";
import { GITHUB_URL, GUMROAD_URL, SITE_NAME } from "@/lib/site";
import type { FaqItem } from "@/lib/schema";
import styles from "./figma-alternative.module.css";

const PAGE_DESCRIPTION =
  "Scamp is a free, open-source Figma alternative for designers. Get full visual and CSS control on a local canvas, use AI coding agents on your real design files, and hand off production-ready TSX and CSS — not a static mockup.";

export const metadata: Metadata = {
  title: "Figma alternative for designers",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/figma-alternative" },
  openGraph: {
    title: `${SITE_NAME} — Figma alternative for designers`,
    description: PAGE_DESCRIPTION,
    url: "/figma-alternative",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Figma alternative for designers`,
    description: PAGE_DESCRIPTION,
  },
};

const comparison: { label: string; figma: string; scamp: string }[] = [
  {
    label: "Where designs live",
    figma: "Cloud-only, stored in Figma's database",
    scamp: "Real files in your own project folder",
  },
  {
    label: "Design output",
    figma: "Proprietary .fig files; PNG / SVG export; Dev Mode snippets",
    scamp: "Production-ready TSX components and CSS Module files",
  },
  {
    label: "Account required",
    figma: "Yes — Figma account and workspace",
    scamp: "No — download and open a project",
  },
  {
    label: "Pricing",
    figma: "Free tier, then paid editor seats",
    scamp: "Free. Source available under BSL on GitHub",
  },
  {
    label: "Works offline",
    figma: "Limited — requires connection for most actions",
    scamp: "Fully offline. No network calls required",
  },
  {
    label: "Version control",
    figma: "Built-in versioning inside Figma",
    scamp: "Native git — designs are plain files you can commit",
  },
  {
    label: "AI coding agents",
    figma: "Plugins or external integrations",
    scamp: "Built-in terminal runs any CLI agent in your project folder",
  },
  {
    label: "Sync with code",
    figma: "One-way via Dev Mode or plugins",
    scamp: "Bidirectional — edit code or canvas, both update",
  },
  {
    label: "Design tokens",
    figma: "Figma Variables (paid)",
    scamp: "Plain CSS custom properties in theme.css",
  },
];

const differences: { q: string; a: React.ReactNode }[] = [
  {
    q: "Full visual and CSS control on the same canvas.",
    a: (
      <>
        Scamp gives you visual controls for layout, spacing, color, and type —
        and a direct CSS editor for everything else. Theme tokens, semantic
        tags, and responsive breakpoints are all first-class instead of hidden
        behind prototypes or plugins. Design exactly what will ship.
      </>
    ),
  },
  {
    q: "AI coding agents work on your real design files.",
    a: (
      <>
        A built-in terminal opens in your project folder, so any CLI agent
        (Claude Code, Codex, Cursor CLI, Gemini CLI) can read and write the
        same TSX and CSS Modules the canvas renders. When the agent saves, the
        canvas hot-reloads — AI becomes a design collaborator, not a separate
        tool.
      </>
    ),
  },
  {
    q: "Handoff to developers is a pull request.",
    a: (
      <>
        Every page is a <code>.tsx</code> file and a <code>.module.css</code>{" "}
        file on your disk. Commit them, open a PR, and the developer reviews
        real code — not a PNG with measurements. There is no Dev Mode, no
        plugin export, and no re-implementation step.
      </>
    ),
  },
  {
    q: "Your work stays yours.",
    a: (
      <>
        Scamp is local-first. Designs live in a folder you choose, never on a
        Scamp server. You can put them inside an existing repo, hand them off,
        or keep going without Scamp — everything is plain code you own. See the{" "}
        <Link href="/trust">trust page</Link> for exactly what Scamp reads and
        writes.
      </>
    ),
  },
];

const faqItems: FaqItem[] = [
  {
    question: "Is Scamp really a 1:1 replacement for Figma?",
    answer:
      "No — and it is not trying to be. Scamp is a focused design tool for designers who want their work to ship as real code. It does not do freeform whiteboarding, multiplayer cursors, brand work, or generic vector illustration. If you need Figma for those workflows, keep using it. Use Scamp for the UI design that is meant to become product.",
  },
  {
    question: "Can I import Figma files?",
    answer:
      "Not today. Scamp's input is its own canvas and the TSX/CSS files on your disk. If there is demand for a Figma importer, it may come in the future — track progress on the GitHub repo.",
  },
  {
    question: "What file format does Scamp save designs in?",
    answer:
      "Scamp saves designs as real React and CSS code: one .tsx file and one .module.css file per page, plus a shared theme.css for design tokens and an agent.md with instructions for AI coding agents. Everything is plain text you can read, edit, diff, and commit.",
  },
  {
    question: "Does Scamp support responsive design?",
    answer:
      "Yes. Scamp has a breakpoint system (desktop, tablet, mobile by default) that maps directly to @media (max-width: N) rules in the generated CSS. You can add or customize breakpoints per project.",
  },
  {
    question: "Does Scamp work with my team's framework?",
    answer:
      "Scamp generates React TSX and CSS Modules, which drop cleanly into Next.js, Remix, Vite + React, and most React-based frameworks. The output is framework-agnostic React — no Scamp runtime or wrapper required, so your developers can take the files as-is.",
  },
  {
    question: "What happens if I stop using Scamp?",
    answer:
      "You keep all your work. A Scamp project is just a folder of TSX and CSS files — open it in any editor, commit it to any repo, delete Scamp, and the code keeps running. There is no lock-in.",
  },
];

export default function FigmaAlternativePage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Figma alternative · For designers</p>
            <h1 className={styles.title}>
              A Figma alternative with full visual and CSS control.
            </h1>
            <p className={styles.subtitle}>
              Scamp is a free, open-source design tool for designers who want
              full authorship over the work they ship. Craft layouts visually
              or drop into raw CSS, collaborate with AI coding agents on your
              real design files, and hand developers production-ready TSX and
              CSS — no export step, no Dev Mode.
            </p>
            <div className={styles.ctaRow}>
              <a
                href={GUMROAD_URL}
                target="_blank"
                rel="noreferrer"
                className={styles.primaryCta}
              >
                Download Scamp
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className={styles.secondaryCta}
              >
                View source on GitHub ↗
              </a>
            </div>
          </header>

          <div className={styles.screenshotWrap}>
            <Image
              src="/scamp.png"
              alt="Scamp showing a visual design canvas next to the generated TSX and CSS code"
              width={2805}
              height={1690}
              sizes="(max-width: 960px) 100vw, 960px"
              priority
            />
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Scamp vs Figma at a glance</h2>
              <p className={styles.sectionLead}>
                Both are design tools. They give designers different kinds of
                control and produce different outputs. Here is how they compare
                when your goal is shipping real, styled components.
              </p>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.compareTable}>
                <thead>
                  <tr>
                    <th scope="col"> </th>
                    <th scope="col">Figma</th>
                    <th scope="col" className="product">Scamp</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.label}>
                      <td scope="row">{row.label}</td>
                      <td>{row.figma}</td>
                      <td className={styles.scampCol}>{row.scamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>What makes Scamp different</h2>
              <p className={styles.sectionLead}>
                Four concrete differences that matter when you are shipping
                production code.
              </p>
            </div>
            <div className={styles.qaList}>
              {differences.map((d, i) => (
                <article key={i} className={styles.qaItem}>
                  <h3 className={styles.qaQuestion}>{d.q}</h3>
                  <p className={styles.qaAnswer}>{d.a}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <FAQ
          eyebrow="Switching from Figma"
          headline="Questions people ask before switching"
          items={faqItems}
        />

        <div className={styles.inner} style={{ marginTop: "var(--space-7)" }}>
          <div className={styles.ctaRow}>
            <a
              href={GUMROAD_URL}
              target="_blank"
              rel="noreferrer"
              className={styles.primaryCta}
            >
              Try Scamp — free
            </a>
            <Link href="/docs" className={styles.secondaryCta}>
              Read the docs
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <JsonLd
        data={[
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Figma alternative", url: "/figma-alternative" },
          ]),
        ]}
      />
    </>
  );
}
