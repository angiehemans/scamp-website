import type { Metadata } from "next";
import Image from "next/image";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import JsonLd from "@/components/JsonLd/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { GUMROAD_URL, OWNER_NAME, SITE_NAME, SITE_URL } from "@/lib/site";
import styles from "./about.module.css";

const PAGE_DESCRIPTION =
  "Scamp is a design tool built by a designer who codes — for designers who want to work closer to the code. The story behind why it exists and how it gets made.";

export const metadata: Metadata = {
  title: "About",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: `About — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: "/about",
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
    title: `About — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

const aboutPageSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: `About ${SITE_NAME}`,
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}/about`,
  isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  about: { "@type": "Person", name: OWNER_NAME },
};

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>About</p>
            <h1 className={styles.title}>Why Scamp exists</h1>
          </header>

          <section className={styles.section}>
            <p className={styles.body}>
              I have been a UX designer and developer for over ten years.
              For most of that time I was stuck in the same frustrating
              loop: designing something I was proud of, handing it off,
              and watching it come back almost right but not quite. The
              spacing slightly off. The border radius wrong. The hover
              state that got cut because there was not enough time.
            </p>
            <p className={styles.body}>
              It is not a people problem. Every developer I have worked
              with has been talented and well intentioned. It is a tools
              problem. Design lives in one place, code lives in another,
              and something always gets lost when you move between them.
            </p>
            <p className={styles.body}>
              I tried everything. Better handoff tools, design tokens,
              detailed annotations. They helped a little. None of them
              actually fixed it.
            </p>
            <p className={styles.body}>
              Eventually I got tired of waiting for someone else to build
              the tool I needed, so I built it myself.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>A little about me</h2>
            <p className={styles.body}>
              I am a designer who got into code and never looked back. Over
              the last decade I have worked at startups as an individual
              contributor, built design teams from scratch, and led design
              at the VP and Director level at a few different companies.
            </p>
            <p className={styles.body}>
              What has stayed consistent across all of it is that I think
              about design and code as the same thing. I understand CSS the
              way a developer does. I approach problems the way a designer
              does. Scamp needed both of those things to exist, which is
              probably why no one else built it first.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>How I build it</h2>
            <p className={styles.body}>
              I use Scamp to design Scamp. That sounds like a gimmick but
              it is genuinely how I work. Every time something feels
              awkward I fix it. Every time a feature is missing I add it.
              The tool keeps getting better because I keep running into
              its edges.
            </p>
            <p className={styles.body}>
              It is open source, free to download, and built for designers
              who want to work closer to the code, with or without a
              coding agent helping them along the way.
            </p>
            <p className={styles.body}>If that sounds like you, come try it.</p>

            <div className={styles.ctaRow}>
              <a
                href={GUMROAD_URL}
                target="_blank"
                rel="noreferrer"
                className={styles.primaryCta}
              >
                Download Scamp
              </a>
            </div>

            <div className={styles.signoff}>
              <Image
                src="/angie.jpg"
                alt="Angie Hemans"
                width={2238}
                height={2240}
                className={styles.signPhoto}
                sizes="120px"
              />
              <div className={styles.signText}>
                <p className={styles.signName}>— Angie</p>
                <a
                  href="https://www.threads.net/@angie.uxdev"
                  target="_blank"
                  rel="noreferrer"
                  className={styles.signLink}
                >
                  @angie.uxdev on Threads ↗
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <JsonLd
        data={[
          aboutPageSchema,
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "About", url: "/about" },
          ]),
        ]}
      />
    </>
  );
}
