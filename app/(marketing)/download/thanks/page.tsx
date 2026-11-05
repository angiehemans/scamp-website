import type { Metadata } from "next";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import DitherGradient from "@/components/DitherGradient/DitherGradient";
import ThanksFlow from "./ThanksFlow";
import styles from "../download.module.css";

export const metadata: Metadata = {
  title: "Thank you",
  // Nobody should arrive here from a search result — it only means anything
  // with a checkout session in the URL.
  robots: { index: false, follow: false },
};

export default function ThanksPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <DitherGradient variant="pageTop" />
        <div className={styles.inner}>
          <header className={styles.header}>
            <h1 className={styles.title}>Thank you</h1>
            <p className={styles.subtitle}>
              Your support keeps Scamp free for everyone else.
            </p>
          </header>

          <ThanksFlow />
        </div>
      </main>
      <Footer />
    </>
  );
}
