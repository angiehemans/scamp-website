import type { Metadata } from "next";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import DitherGradient from "@/components/DitherGradient/DitherGradient";
import { SITE_NAME } from "@/lib/site";
import DownloadFlow from "./DownloadFlow";
import styles from "./download.module.css";

const PAGE_DESCRIPTION =
  "Download Scamp for macOS, Windows, or Linux. Free with no feature limits and no account required. Pay what you want if it is useful to you.";

export const metadata: Metadata = {
  title: "Download",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/download" },
  openGraph: {
    title: `Download — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: "/download",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Download — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

/**
 * Public download page. Everything interactive is in DownloadFlow, so this
 * shell stays static like the rest of the marketing group — no cookies are read
 * at render time.
 */
export default function DownloadPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <DitherGradient variant="pageTop" />
        <div className={styles.inner}>
          <header className={styles.header}>
            <h1 className={styles.title}>Download Scamp</h1>
            <p className={styles.subtitle}>
              The full design tool, free forever. Your projects stay on your
              machine as real TSX and CSS files.
            </p>
          </header>

          <DownloadFlow />
        </div>
      </main>
      <Footer />
    </>
  );
}
