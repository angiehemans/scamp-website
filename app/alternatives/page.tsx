import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import JsonLd from "@/components/JsonLd/JsonLd";
import { breadcrumbSchema, softwareApplicationSchema } from "@/lib/schema";
import { GITHUB_URL, GUMROAD_URL, SITE_NAME, SITE_URL } from "@/lib/site";
import styles from "./alternatives.module.css";

const PAGE_DESCRIPTION =
  "How Scamp compares to Figma, Framer, Onlook, Subframe, and Claude Design. Side-by-side breakdown of real code output, design freedom, local-first architecture, and AI agent support — so you can pick the right design-to-code tool.";

export const metadata: Metadata = {
  title: "Scamp vs the alternatives",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/alternatives" },
  openGraph: {
    title: `Scamp vs the alternatives — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: "/alternatives",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Scamp vs the alternatives — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

type Status = "yes" | "no" | "partial";

const tools = [
  "Scamp",
  "Figma",
  "Framer",
  "Onlook",
  "Subframe",
  "Claude Design",
] as const;
type Tool = (typeof tools)[number];

const rows: { feature: string; values: Record<Tool, Status> }[] = [
  {
    feature: "Saves as real code",
    values: {
      Scamp: "yes",
      Figma: "no",
      Framer: "partial",
      Onlook: "yes",
      Subframe: "partial",
      "Claude Design": "partial",
    },
  },
  {
    feature: "Full design control, not just prompts",
    values: {
      Scamp: "yes",
      Figma: "yes",
      Framer: "yes",
      Onlook: "yes",
      Subframe: "partial",
      "Claude Design": "no",
    },
  },
  {
    feature: "Real CSS, not just Tailwind",
    values: {
      Scamp: "yes",
      Figma: "no",
      Framer: "no",
      Onlook: "no",
      Subframe: "no",
      "Claude Design": "no",
    },
  },
  {
    feature: "Local app, not web based",
    values: {
      Scamp: "yes",
      Figma: "no",
      Framer: "no",
      Onlook: "yes",
      Subframe: "no",
      "Claude Design": "no",
    },
  },
  {
    feature: "Draw freely on canvas",
    values: {
      Scamp: "yes",
      Figma: "yes",
      Framer: "yes",
      Onlook: "partial",
      Subframe: "partial",
      "Claude Design": "no",
    },
  },
  {
    feature: "Built-in terminal",
    values: {
      Scamp: "yes",
      Figma: "no",
      Framer: "no",
      Onlook: "no",
      Subframe: "no",
      "Claude Design": "no",
    },
  },
  {
    feature: "Bidirectional sync",
    values: {
      Scamp: "yes",
      Figma: "no",
      Framer: "no",
      Onlook: "partial",
      Subframe: "no",
      "Claude Design": "no",
    },
  },
  {
    feature: "Files saved to your folder",
    values: {
      Scamp: "yes",
      Figma: "no",
      Framer: "no",
      Onlook: "yes",
      Subframe: "no",
      "Claude Design": "no",
    },
  },
  {
    feature: "No account required",
    values: {
      Scamp: "yes",
      Figma: "no",
      Framer: "no",
      Onlook: "no",
      Subframe: "no",
      "Claude Design": "no",
    },
  },
];

const partialNotes: { tool: Tool; feature: string; body: string }[] = [
  {
    tool: "Framer",
    feature: "Saves as real code",
    body: "Framer can export React code, but it is formatted for Framer's own hosting and runtime. The output is not standard files you own in a normal project folder.",
  },
  {
    tool: "Onlook",
    feature: "Draw freely on canvas",
    body: "Onlook requires an existing running Next.js project to connect to. You cannot open a blank canvas and start drawing from scratch.",
  },
  {
    tool: "Onlook",
    feature: "Bidirectional sync",
    body: "Onlook reads your existing project files and reflects them visually, which is close. It is more “connect to existing code” than live bidirectional sync where any external edit instantly updates the canvas.",
  },
  {
    tool: "Subframe",
    feature: "Full design control",
    body: "Subframe is built around a component system with auto-layout always on. There is no freeform canvas. Layouts are constrained to an existing component library rather than drawn freely.",
  },
  {
    tool: "Subframe",
    feature: "Saves as real code",
    body: "Subframe exports React and Tailwind CSS via a CLI sync command. It is not continuous automatic output the way Scamp writes files on every change.",
  },
  {
    tool: "Claude Design",
    feature: "Saves as real code",
    body: "Claude Design generates React and Tailwind CSS as chat artifacts you can copy or download. There is no live workflow where the tool writes to a project folder you own — the output is a snapshot, not a file watched on disk.",
  },
];

function StatusCell({ status }: { status: Status }) {
  if (status === "yes") {
    return (
      <span className={`${styles.status} ${styles.statusYes}`}>
        <span aria-hidden="true">✓</span>
        <span className={styles.srOnly}>Yes</span>
      </span>
    );
  }
  if (status === "no") {
    return (
      <span className={`${styles.status} ${styles.statusNo}`}>
        <span aria-hidden="true">✕</span>
        <span className={styles.srOnly}>No</span>
      </span>
    );
  }
  return (
    <span className={`${styles.status} ${styles.statusPartial}`}>
      <span aria-hidden="true">◐</span>
      <span className={styles.statusLabel}>Partial</span>
    </span>
  );
}

export default function AlternativesPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Compare · For designers</p>
            <h1 className={styles.title}>
              How Scamp compares to other design-to-code tools.
            </h1>
            <p className={styles.subtitle}>
              Not all design tools are equal when it comes to real code
              output, design freedom, and how close they let you stay to
              your codebase. Here is how Scamp stacks up against{" "}
              <Link href="/figma-alternative">Figma</Link>, Framer, Onlook,
              Subframe, and Claude Design.
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
              <Link href="/pricing" className={styles.secondaryCta}>
                See pricing
              </Link>
            </div>
          </header>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Comparison matrix</h2>
              <p className={styles.sectionLead}>
                A side-by-side look at the features designers ask about most
                when evaluating design-to-code tools.
              </p>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.compareTable}>
                <thead>
                  <tr>
                    <th scope="col">Feature</th>
                    {tools.map((t) => (
                      <th
                        key={t}
                        scope="col"
                        className={t === "Scamp" ? styles.productHeader : ""}
                      >
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.feature}>
                      <th scope="row">{row.feature}</th>
                      {tools.map((t) => (
                        <td
                          key={t}
                          className={t === "Scamp" ? styles.scampCol : ""}
                        >
                          <StatusCell status={row.values[t]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Notes on partials</h2>
              <p className={styles.sectionLead}>
                Where another tool is close but not quite, here is exactly
                what is missing.
              </p>
            </div>
            <div className={styles.noteList}>
              {partialNotes.map((n, i) => (
                <article key={i} className={styles.note}>
                  <h3 className={styles.noteTitle}>
                    <span className={styles.noteTool}>{n.tool}</span>{" "}
                    <span className={styles.noteSeparator}>—</span>{" "}
                    <span className={styles.noteFeature}>{n.feature}</span>{" "}
                    <span className={styles.notePartialBadge}>Partial</span>
                  </h3>
                  <p className={styles.noteBody}>{n.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Why real CSS matters</h2>
            <p className={styles.body}>
              Most tools in this category output Tailwind CSS. Tailwind is a
              great utility framework, but it is a specific choice that
              locks your output to a particular way of writing styles. Not
              every project uses Tailwind. Not every developer wants it.
            </p>
            <p className={styles.body}>
              Scamp outputs standard{" "}
              <Link href="/docs/code-output">CSS Modules</Link>. Plain,
              readable CSS in a <code>.module.css</code> file that works
              with any React project, any bundler, and any developer. No
              framework dependency. No utility class soup in your JSX. Just
              CSS, written the way you would write it yourself.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Why local matters</h2>
            <p className={styles.body}>
              Web-based design tools store your files on someone else's
              server. Your work depends on their uptime, their pricing, and
              their decisions about your data.
            </p>
            <p className={styles.body}>
              Scamp saves to a folder on your machine. Your project is a
              real folder you can open in any editor, commit to git, move,
              copy, or back up however you want. The files are yours
              because they literally are yours, sitting on your disk right
              now. See the <Link href="/trust">trust page</Link> for
              exactly what Scamp reads and writes.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Why the terminal changes everything
            </h2>
            <p className={styles.body}>
              No other design tool ships with a real terminal. Scamp does.
            </p>
            <p className={styles.body}>
              Open the <Link href="/docs/terminal">built-in terminal</Link>,
              run Claude Code or any other coding agent, and ask it to make
              changes to your layout. Scamp watches the files and updates
              the canvas automatically through{" "}
              <Link href="/docs/bidirectional-sync">bidirectional sync</Link>
              . You never leave the app. You never lose context. The agent
              works in the same project folder your design lives in,
              because they are the same thing.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Which tool is right for you?</h2>
            <p className={styles.body}>
              Every tool on this list is doing interesting work in the design-to-code space. The right one depends on your workflow, your stack, and how close to the code you want to be.
            </p>
            <p className={styles.body}>
               Scamp is built for designers who want to stay close to the code, work alongside agents, and own their output completely. If you want a tool where your design and your code are the same thing, where every rectangle you draw is a real component, every style you set is real CSS, and your coding agent works right alongside you, that is Scamp. Give it a try.
            </p>
          </section>
        </div>

        <section className={styles.cta}>
          <div className={styles.ctaInner}>
            <h2 className={styles.ctaHeadline}>Download Scamp free</h2>
            <p className={styles.ctaSub}>
              No account required. Your files stay on your machine.
            </p>
            <div className={styles.downloadGrid}>
              <a
                href={GUMROAD_URL}
                target="_blank"
                rel="noreferrer"
                className={styles.downloadBtn}
              >
                Download for Mac
              </a>
              <a
                href={GUMROAD_URL}
                target="_blank"
                rel="noreferrer"
                className={styles.downloadBtn}
              >
                Download for Windows
              </a>
              <a
                href={GUMROAD_URL}
                target="_blank"
                rel="noreferrer"
                className={styles.downloadBtn}
              >
                Download for Linux
              </a>
            </div>
            <p className={styles.ctaMeta}>
              Or{" "}
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                view the source on GitHub ↗
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <JsonLd
        data={[
          softwareApplicationSchema(),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Scamp vs the alternatives",
            description: PAGE_DESCRIPTION,
            url: `${SITE_URL}/alternatives`,
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
          },
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Alternatives", url: "/alternatives" },
          ]),
        ]}
      />
    </>
  );
}
