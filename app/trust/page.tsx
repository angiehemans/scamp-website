import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import JsonLd from "@/components/JsonLd/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { GITHUB_URL, SITE_URL, SITE_NAME } from "@/lib/site";
import styles from "./trust.module.css";

const PAGE_DESCRIPTION =
  "How Scamp handles your design files. Local-first architecture, what Scamp reads and writes, no cloud sync, no telemetry, open-source code you can audit.";

export const metadata: Metadata = {
  title: "Trust & data handling",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/trust" },
  openGraph: {
    title: `Trust & data handling — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: "/trust",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: `Trust & data handling — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

const webpageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Trust & data handling",
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}/trust`,
  isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
};

export default function TrustPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Trust & data handling</p>
            <h1 className={styles.title}>Your files. Your machine. No cloud.</h1>
            <p className={styles.subtitle}>
              Scamp is a local-first desktop application. It reads and writes
              plain files inside a project folder you control. It does not
              upload your designs, does not send telemetry about your layouts,
              and has no backend for your work to live in.
            </p>
          </header>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Quick summary</h2>
            <table className={styles.summaryTable}>
              <thead>
                <tr>
                  <th>Concern</th>
                  <th>How Scamp handles it</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Where designs are stored</td>
                  <td>On your local disk, in the project folder you choose.</td>
                </tr>
                <tr>
                  <td>Cloud sync</td>
                  <td>None. Scamp has no servers for design data.</td>
                </tr>
                <tr>
                  <td>Account</td>
                  <td>Not required to use the app.</td>
                </tr>
                <tr>
                  <td>Telemetry</td>
                  <td>No design data is collected.</td>
                </tr>
                <tr>
                  <td>File access scope</td>
                  <td>The project folder you open. Nothing outside it.</td>
                </tr>
                <tr>
                  <td>Network calls</td>
                  <td>
                    Only when checking for app updates or when you explicitly
                    open a link (e.g. GitHub).
                  </td>
                </tr>
                <tr>
                  <td>Source code</td>
                  <td>Open and auditable on GitHub under BSL.</td>
                </tr>
                <tr>
                  <td>Lock-in</td>
                  <td>
                    None. Projects are plain TSX and CSS Module files you can
                    keep using without Scamp.
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>What Scamp reads</h2>
            <p className={styles.body}>
              When you open a project, Scamp reads the files inside that
              project folder so it can render them on the canvas:
            </p>
            <ul className={styles.list}>
              <li>
                <strong>Page files</strong> — the <code>.tsx</code> and matching{" "}
                <code>.module.css</code> files that describe each page layout.
              </li>
              <li>
                <strong>theme.css</strong> — your design tokens (colors,
                spacing, radii, fonts) defined as CSS custom properties.
              </li>
              <li>
                <strong>agent.md</strong> — an instructions file that AI coding
                agents read so they can edit Scamp projects correctly.
              </li>
              <li>
                <strong>Image assets</strong> — files you reference in your
                pages (e.g. PNGs, SVGs, user uploads) so the canvas can render
                them.
              </li>
            </ul>
            <p className={styles.body}>
              Scamp does not read files outside the project folder. Opening a
              different project means opening a different folder — nothing
              crosses over.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>What Scamp writes</h2>
            <p className={styles.body}>
              Scamp writes changes back to the same files you opened. Every
              edit on the canvas is a change to real code on disk — not a
              database entry somewhere.
            </p>
            <ul className={styles.list}>
              <li>
                Editing a layout writes the updated TSX and CSS Module files
                for that page.
              </li>
              <li>
                Editing a theme token writes <code>theme.css</code>.
              </li>
              <li>
                Renaming a page renames the corresponding files.
              </li>
              <li>
                App-level preferences (default project folder, theme) live in
                your OS user config directory, not in your project folder.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>What Scamp does not do</h2>
            <ul className={styles.list}>
              <li>
                <strong>No cloud sync.</strong> Your designs never leave your
                machine unless you explicitly push them to a git remote or send
                the files yourself.
              </li>
              <li>
                <strong>No analytics on your designs.</strong> The shapes,
                colors, and layouts you draw are not reported anywhere.
              </li>
              <li>
                <strong>No account, no login.</strong> Scamp does not have a
                user directory for you to exist in.
              </li>
              <li>
                <strong>No plugin marketplace execution.</strong> Scamp does
                not auto-run third-party code from an online marketplace.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>AI coding agents & permissions</h2>
            <p className={styles.body}>
              Scamp has a built-in terminal that opens in your project folder.
              You can run any CLI coding agent — Claude Code, Codex, Gemini CLI,
              OpenCode, or whatever else you use — the same way you would run
              it in a normal terminal.
            </p>
            <ul className={styles.list}>
              <li>
                <strong>The agent runs under your user account.</strong> Its
                file access is whatever your shell already allows — Scamp does
                not grant extra permissions.
              </li>
              <li>
                <strong>Approvals are controlled by the agent itself.</strong>{" "}
                If the agent requires human approval for destructive actions,
                Scamp inherits that behavior.
              </li>
              <li>
                <strong>Scamp reads <code>agent.md</code> for instructions.</strong>{" "}
                This file tells the agent how Scamp expects its project files
                to look. You can read, edit, or delete it.
              </li>
              <li>
                <strong>You can turn it off.</strong> The terminal panel is
                optional. If you never open it, no agent ever runs.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Open source & license</h2>
            <p className={styles.body}>
              Scamp is source-available on GitHub under the{" "}
              <a
                href="https://mariadb.com/bsl11/"
                target="_blank"
                rel="noreferrer"
              >
                Business Source License (BSL)
              </a>
              . You can read the code, build from source, audit it, and use it
              for free. See the repository for full terms.
            </p>
            <p className={styles.body}>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                github.com/angiehemans/scamp ↗
              </a>
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Reporting a concern</h2>
            <p className={styles.body}>
              Think you found a security issue or a data-handling bug? Open an
              issue on{" "}
              <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer">
                GitHub
              </a>{" "}
              — or, if the issue is sensitive, mark it privately in the
              repository. We triage reports as they come in.
            </p>
            <p className={styles.body}>
              Want to understand how Scamp works end-to-end? Start with{" "}
              <Link href="/docs/bidirectional-sync">Bidirectional Sync</Link>{" "}
              in the docs.
            </p>
          </section>
        </div>
      </main>
      <Footer />
      <JsonLd
        data={[
          webpageSchema,
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Trust", url: "/trust" },
          ]),
        ]}
      />
    </>
  );
}
