import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import JsonLd from "@/components/JsonLd/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import styles from "./roadmap.module.css";

const PAGE_DESCRIPTION =
  "What's coming to Scamp. A Pro tier with cloud backup, cross-device sync, preview links, comments, and team accounts — plus new data binding, component, and canvas features for designers.";

export const metadata: Metadata = {
  title: "Roadmap",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/roadmap" },
  openGraph: {
    title: `Roadmap — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: "/roadmap",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Roadmap — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

const webpageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Roadmap",
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}/roadmap`,
  isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
};

interface Feature {
  title: string;
  desc: string;
}

const PRO_FEATURES: Feature[] = [
  {
    title: "Cloud backup",
    desc: "Optional, secure backups of your project folder so your work is safe beyond your local disk.",
  },
  {
    title: "Cross-device sync",
    desc: "Pick up a project on another machine and keep your designs in sync across devices.",
  },
  {
    title: "Preview links",
    desc: "Share a live, hosted preview of a design with a single URL — no export step required.",
  },
  {
    title: "Comments",
    desc: "Leave, reply to, and resolve feedback directly on a design instead of in a separate thread.",
  },
  {
    title: "Team accounts",
    desc: "Shared workspaces and member management for design teams working together.",
  },
];

const DATA_FEATURES: Feature[] = [
  {
    title: "Real data in designs",
    desc: "Bind elements to real datasets so layouts fill with actual content instead of placeholder text.",
  },
  {
    title: "Connect to APIs",
    desc: "Pull live content into the canvas straight from external APIs.",
  },
  {
    title: "Markdown support",
    desc: "Author and render markdown content inside your designs.",
  },
  {
    title: "State management",
    desc: "Model interactive states and drive them across a design.",
  },
];

const COMPONENT_FEATURES: Feature[] = [
  {
    title: "Component slots",
    desc: "Define insertion points so a component can accept nested content where you want it.",
  },
  {
    title: "Variants",
    desc: "Build one component with multiple styles or states and switch between them.",
  },
];

const EDITOR_FEATURES: Feature[] = [
  {
    title: "More CSS properties",
    desc: "An expanded set of CSS properties editable directly in the visual panel.",
  },
  {
    title: "Tables",
    desc: "Build and design data tables right on the canvas.",
  },
];

function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <ul className={styles.grid}>
      {features.map((feature) => (
        <li key={feature.title} className={styles.card}>
          <span className={styles.cardTitle}>{feature.title}</span>
          <span className={styles.cardDesc}>{feature.desc}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RoadmapPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Roadmap</p>
            <h1 className={styles.title}>What we&rsquo;re building next</h1>
            <p className={styles.subtitle}>
              Scamp stays local-first and free at its core. Here&rsquo;s where
              we&rsquo;re headed — a Pro tier for hosted collaboration, plus
              deeper data, component, and canvas features for designers.
            </p>
          </header>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Scamp Pro</h2>
              <span className={styles.badge}>Paid tier</span>
            </div>
            <p className={styles.body}>
              A paid tier for individuals and teams who want their work backed
              up, synced, and shared. The local-first editor stays free.
            </p>
            <FeatureGrid features={PRO_FEATURES} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Data</h2>
            <p className={styles.body}>
              Move beyond static mockups — design against the data your product
              actually uses.
            </p>
            <FeatureGrid features={DATA_FEATURES} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Components</h2>
            <p className={styles.body}>
              More powerful, reusable components that map cleanly to the code
              Scamp hands off.
            </p>
            <FeatureGrid features={COMPONENT_FEATURES} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Canvas &amp; visual editing</h2>
            <p className={styles.body}>
              More of what you can build and control directly on the canvas.
            </p>
            <FeatureGrid features={EDITOR_FEATURES} />
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Have a request?</h2>
            <p className={styles.body}>
              This roadmap is directional and will shift as we learn what
              designers need most — nothing here is a dated commitment. Want to
              weigh in on priorities? Open an issue or start a discussion on{" "}
              <a
                href="https://github.com/angiehemans/scamp/issues"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              , or see what&rsquo;s already shipped in the{" "}
              <Link href="/changelog">changelog</Link>.
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
            { name: "Roadmap", url: "/roadmap" },
          ]),
        ]}
      />
    </>
  );
}
