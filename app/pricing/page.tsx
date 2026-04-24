import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import JsonLd from "@/components/JsonLd/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import {
  GITHUB_ISSUES_URL,
  GUMROAD_URL,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import styles from "./pricing.module.css";

const PAGE_DESCRIPTION =
  "Scamp is free and always will be. A Pro tier with cloud features (shareable previews, comments, backup, version history) may arrive someday. Here's what each tier includes.";

export const metadata: Metadata = {
  title: "Pricing",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: `Pricing — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: "/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Pricing — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

const offerSchema = {
  "@context": "https://schema.org",
  "@type": "Offer",
  name: "Scamp Free",
  price: "0",
  priceCurrency: "USD",
  availability: "https://schema.org/InStock",
  url: `${SITE_URL}/pricing`,
  category: "free",
};

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Pricing</p>
            <h1 className={styles.title}>
              Free today. Free tomorrow.
            </h1>
            <p className={styles.subtitle}>
              Scamp is free to download and use — and the local design tool
              always will be. A Pro tier focused on cloud features may come
              someday, maybe. Here's the plan.
            </p>
          </header>

          <div className={styles.grid}>
            <article className={styles.card}>
              <div className={styles.cardHead}>
                <div className={styles.tierRow}>
                  <h2 className={styles.tierName}>Free</h2>
                  <span className={`${styles.badge} ${styles.badgeShipped}`}>
                    Available now
                  </span>
                </div>
                <div className={styles.price}>
                  <span className={styles.priceAmount}>$0</span>
                  <span className={styles.pricePeriod}>forever</span>
                </div>
                <p className={styles.tierTagline}>
                  The full local design tool, with no feature limits and no
                  account required. This is the Scamp you can download today.
                </p>
              </div>

              <ul className={styles.features}>
                <li>
                  <strong>The full local design tool</strong> — no feature
                  limits, no watermarks, no per-document caps
                </li>
                <li>
                  <strong>No account required</strong> — download and open a
                  project
                </li>
                <li>Unlimited projects on your machine</li>
                <li>
                  Real TSX and CSS Module files saved directly to disk
                </li>
                <li>Visual and CSS editing on the same canvas</li>
                <li>Theme tokens, breakpoints, and semantic HTML tags</li>
                <li>Built-in terminal for AI coding agents</li>
                <li>
                  <strong>Source available on GitHub</strong> under the
                  Business Source License
                </li>
              </ul>

              <div className={styles.ctaRow}>
                <a
                  href={GUMROAD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.primaryCta}
                >
                  Download Scamp
                </a>
                <Link href="/docs" className={styles.secondaryCta}>
                  Read the docs
                </Link>
              </div>
            </article>

            <article className={`${styles.card} ${styles.cardSpeculative}`}>
              <div className={styles.cardHead}>
                <div className={styles.tierRow}>
                  <h2 className={styles.tierName}>Pro</h2>
                  <span className={`${styles.badge} ${styles.badgeMaybe}`}>
                    Coming someday, maybe
                  </span>
                </div>
                <div className={styles.price}>
                  <span className={styles.priceAmount}>??</span>
                  <span className={styles.pricePeriod}>
                    per month, if it ships
                  </span>
                </div>
                <p className={styles.tierTagline}>
                  Everything in Free, plus cloud features for designers who
                  share work with clients and teams. Nothing here is
                  committed — we're gauging interest.
                </p>
              </div>

              <ul className={`${styles.features} ${styles.featuresSpeculative}`}>
                <li>
                  <strong>Shareable preview links</strong> — send a URL and
                  your client sees the live prototype in a browser, no install
                </li>
                <li>Password-protected share links</li>
                <li>
                  <strong>Comments on prototypes</strong> — stakeholders click
                  anywhere to leave a note, you see it in the app
                </li>
                <li>Comment threads and resolution</li>
                <li>
                  <strong>Cloud backup</strong> — automatic project backup so
                  a dead laptop doesn't cost you work
                </li>
                <li>
                  <strong>Version history</strong> — roll back to any previous
                  state of a project
                </li>
                <li>
                  <strong>Cross-machine sync</strong> — work on your laptop,
                  continue on your desktop
                </li>
              </ul>

              <div className={styles.ctaRow}>
                <a
                  href={`https://forms.gle/tuER52KW5SUKdchFA`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.secondaryCta}
                >
                  Tell us you'd use this ↗
                </a>
                <p className={styles.fineprint}>
                  Pro is a sketch, not a promise. Whether it ships depends on
                  whether enough people tell us they want it.
                </p>
              </div>
            </article>
          </div>

          <div className={styles.note}>
            <h2 className={styles.noteTitle}>
              Why is the local tool free — and will it stay that way?
            </h2>
            <p className={styles.noteBody}>
              Scamp's core belief is that designers should own their work as
              real code on their own machine. Charging a subscription for the
              local design tool would undercut that. The local app is free
              today, and the main project is committed to staying free under
              the Business Source License —{" "}
              <a
                href="https://github.com/angiehemans/scamp"
                target="_blank"
                rel="noreferrer"
              >
                you can read the source and build it yourself
              </a>
              .
            </p>
            <p className={styles.noteBody}>
              If a Pro tier ever arrives, it will be strictly additive
              cloud-hosted features — not gates around things the local tool
              already does. See the{" "}
              <Link href="/trust">trust page</Link> for how Scamp handles your
              files.
            </p>
          </div>
        </div>
      </main>
      <Footer />
      <JsonLd
        data={[
          offerSchema,
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Pricing", url: "/pricing" },
          ]),
        ]}
      />
    </>
  );
}
