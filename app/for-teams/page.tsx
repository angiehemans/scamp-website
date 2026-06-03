import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import JsonLd from "@/components/JsonLd/JsonLd";
import { breadcrumbSchema, softwareApplicationSchema } from "@/lib/schema";
import { GUMROAD_URL, OWNER_NAME, SITE_NAME, SITE_URL } from "@/lib/site";
import styles from "./for-teams.module.css";

// Used by every "Book a call" CTA on this page.
const BOOKING_URL = "https://calendly.com/angiehemans/design-tools-chat";

const PAGE_DESCRIPTION =
  "Scamp for design team leaders. A design tool that writes real production code as your team works, so the design you approved is the design that ships. Book a 30-minute call to see what it would change for your team.";

export const metadata: Metadata = {
  title: "Scamp for design team leaders",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/for-teams" },
  openGraph: {
    title: `Scamp for design team leaders | ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: "/for-teams",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Scamp for design team leaders | ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

const outcomes = [
  {
    title: "What you approved is what ships.",
    body: "Designs are committed as the same TSX and CSS Module files developers will deploy. No Dev Mode export, no re-implementation step, no fidelity drift between sign-off and production.",
  },
  {
    title: "Iteration loops in hours, not sprints.",
    body: "Designers iterate by opening the canvas; developers review the same files in a pull request. The handoff is the commit. Feedback rounds stop blocking on calendar slots.",
  },
  {
    title: "Designers who understand the stack.",
    body: "Your designers write real CSS, work alongside coding agents on actual project files, and build durable fluency with the codebase. The bar for craft goes up; the bar for handoff disappears.",
  },
  {
    title: "One source of truth.",
    body: "Designs live in your repo, version-controlled like any other code. No second cloud system to keep in sync, no proprietary file format to maintain, no design library drifting from production.",
  },
];

const steps = [
  {
    n: "01",
    title: "Designers design on a local canvas.",
    body: "Draw, set properties, apply theme tokens, design responsive breakpoints, visually or in raw CSS. The same craft your team already does, just closer to the metal.",
  },
  {
    n: "02",
    title: "Every change writes real code to your repo.",
    body: "Scamp saves pages as plain TSX and CSS Module files inside a folder you choose. Put it inside an existing repo, branch it, PR it, and review it like any other change.",
  },
  {
    n: "03",
    title: "Developers review code, not pixels.",
    body: "No Dev Mode, no annotated PNGs, no measurement screenshots. Coding agents can iterate alongside designers in a built-in terminal. The same files ship to production.",
  },
];

const faqItems = [
  {
    question: "How long does it take a designer to be productive in Scamp?",
    answer:
      "Designers who are comfortable in Figma get useful work done on day one. The canvas, layers, and properties panel will feel familiar. The conceptual shift, that every element maps to a real HTML tag and every style writes real CSS, usually clicks within the first week. Designers with CSS fluency ramp fastest.",
  },
  {
    question: "Does Scamp work with our framework?",
    answer:
      "Scamp outputs standard React TSX and CSS Modules with no runtime or wrapper. The files drop into Next.js, Remix, Vite + React, and most React-based stacks as-is. There is no Scamp dependency to install in your production codebase.",
  },
  {
    question: "What about our existing design system?",
    answer:
      "Scamp's theme tokens are plain CSS custom properties in a theme.css file, the same shape most design systems already ship. Point Scamp at your tokens and the canvas uses them. Components are a 0.3.x roadmap item; today, repeatable patterns can be wrapped as TSX components by hand or by a coding agent.",
  },
  {
    question: "How do we handle access control and security?",
    answer:
      "Scamp is a local-first desktop application. Designs live in a folder on each designer's machine, typically a clone of your repo. There is no Scamp server holding your work. Access control follows whatever your git provider already enforces. Nothing about a design is uploaded anywhere.",
  },
  {
    question: "What does it cost for a team?",
    answer:
      "The local design tool is free for every seat, and committed to staying free under the Business Source License. There is no per-seat pricing, no editor-seat tier, no usage caps. A speculative cloud-features Pro tier is being explored for shareable previews, comments, and backup, but the local tool will remain free.",
  },
  {
    question: "Do we have to leave Figma?",
    answer:
      "No. Most teams that adopt Scamp run it alongside Figma. Figma for brand work, exploration, and stakeholder review; Scamp for the UI work that is actually meant to ship. The boundary is roughly: if it ends in a PNG, Figma is fine; if it ends in a deploy, Scamp pays off.",
  },
];

const aboutPersonSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: OWNER_NAME,
  jobTitle: "Founder & Designer-Developer",
  worksFor: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  description:
    "Designer-developer with 10+ years leading design at Experience.com (VP), Edgio (Director), and Sencha (Product Design Lead). Building Scamp.",
};

export default function ForTeamsPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>For design team leaders</p>
            <h1 className={styles.title}>
              The design your team approved should be the design that ships.
            </h1>
            <p className={styles.subtitle}>
              Most design tools live somewhere different from your codebase.
              Your team designs in one place, a developer rebuilds it in
              another, and what ships is close but not quite the design you
              signed off on. Scamp writes production-ready React and CSS to
              your repo as designers work, so the design and the code are
              the same thing.
            </p>
            <div className={styles.ctaRow}>
              <a href={BOOKING_URL} className={styles.primaryCta}>
                Book a demo call →
              </a>
              <Link href="/alternatives" className={styles.secondaryCta}>
                See how Scamp compares
              </Link>
            </div>
            <p className={styles.heroMeta}>
              30 minutes. We look at your team's current design-to-code flow,
              and I show you exactly what Scamp would change.
            </p>
          </div>
        </section>

        <div className={styles.inner}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionEyebrow}>The problem</p>
              <h2 className={styles.sectionTitle}>The handoff tax.</h2>
            </div>
            <div className={styles.proseGrid}>
              <p className={styles.body}>
                Your team spends days getting a design right: the hierarchy,
                the spacing, the details that separate considered work from
                assembled work. Then it gets handed to engineering. A
                developer rebuilds it under deadline. The border radius is
                wrong, the font weight drifts, the hover state gets cut for
                time. Feedback is filed. Some of it gets addressed. The work
                that ships is an approximation of the work you signed off on.
              </p>
              <p className={styles.body}>
                That's the handoff tax. Most leaders treat it as a fixed cost
                of running a design team. It isn't. It's a tooling artifact.
                Design and code live in different systems, so something
                always gets lost when you move between them.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionEyebrow}>What changes</p>
              <h2 className={styles.sectionTitle}>What your team gets back.</h2>
            </div>
            <div className={styles.outcomesGrid}>
              {outcomes.map((o) => (
                <article key={o.title} className={styles.outcomeCard}>
                  <h3 className={styles.outcomeTitle}>{o.title}</h3>
                  <p className={styles.outcomeBody}>{o.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionEyebrow}>How it works</p>
              <h2 className={styles.sectionTitle}>How it fits your team.</h2>
            </div>
            <ol className={styles.steps}>
              {steps.map((s) => (
                <li key={s.n} className={styles.step}>
                  <span className={styles.stepNum} aria-hidden="true">
                    {s.n}
                  </span>
                  <div className={styles.stepBody}>
                    <h3 className={styles.stepTitle}>{s.title}</h3>
                    <p className={styles.stepText}>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionEyebrow}>Who built this</p>
              <h2 className={styles.sectionTitle}>
                Built by a design leader, for design leaders.
              </h2>
            </div>
            <div className={styles.bioRow}>
              <Image
                src="/angie.jpg"
                alt="Angie Hemans"
                width={2238}
                height={2240}
                className={styles.bioPhoto}
                sizes="160px"
              />
              <div className={styles.bioText}>
                <p className={styles.body}>
                  I'm Angie Hemans. I have been VP of Product Design at
                  Experience.com, Director of Design at Edgio, and Product
                  Design Lead at Sencha. Every team I led ran into the same
                  wall between design and code, and no tool I tried actually
                  closed the gap. Scamp is the tool I always wished I'd had, so I built it.
                </p>
                <p className={styles.body}>
                  I'd like to understand your team's specific workflow
                  before I tell you whether Scamp is the right fit. That's
                  what the call is for.
                </p>
                <div className={styles.bioCtaRow}>
                  <a href={BOOKING_URL} className={styles.primaryCta}>
                    Book a 30-minute call →
                  </a>
                  <Link href="/about" className={styles.tertiaryLink}>
                    More about me
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionEyebrow}>Questions leaders ask</p>
              <h2 className={styles.sectionTitle}>
                Before the call, the easy ones.
              </h2>
            </div>
            <div className={styles.faqList}>
              {faqItems.map((f) => (
                <article key={f.question} className={styles.faqItem}>
                  <h3 className={styles.faqQuestion}>{f.question}</h3>
                  <p className={styles.faqAnswer}>{f.answer}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className={styles.closingCta}>
          <div className={styles.closingInner}>
            <h2 className={styles.closingHeadline}>
              Let's talk about your team's workflow.
            </h2>
            <p className={styles.closingSub}>
              30 minutes, no slides. We walk through how your team designs
              and ships today, and I show you what Scamp would replace.
              Honest answers about whether it's a fit.
            </p>
            <div className={styles.closingCtaRow}>
              <a href={BOOKING_URL} className={styles.primaryCtaLarge}>
                Book a demo call →
              </a>
              <a
                href={GUMROAD_URL}
                target="_blank"
                rel="noreferrer"
                className={styles.secondaryCtaLarge}
              >
                Or try Scamp on your own first
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <JsonLd
        data={[
          softwareApplicationSchema(),
          aboutPersonSchema,
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Scamp for design team leaders",
            description: PAGE_DESCRIPTION,
            url: `${SITE_URL}/for-teams`,
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
            audience: {
              "@type": "Audience",
              audienceType: "Design team leaders",
            },
          },
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "For teams", url: "/for-teams" },
          ]),
        ]}
      />
    </>
  );
}
