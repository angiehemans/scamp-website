import DitherGradient from "@/components/DitherGradient/DitherGradient";
import { BOOKING_URL } from "@/lib/site";
import styles from "./BookDemo.module.css";

/**
 * Closing "book a demo" band. Render directly above <Footer /> on any page.
 * Headline and body can be overridden per page when the surrounding context
 * calls for a more specific pitch.
 */
export default function BookDemo({
  headline = "See Scamp in action.",
  body = "Book a 30 minute call. No slides. We walk through how you design and ship today, and I show you exactly where Scamp fits.",
  ctaLabel = "Schedule a demo",
}: {
  headline?: string;
  body?: string;
  ctaLabel?: string;
}) {
  return (
    <section className={styles.section}>
      <DitherGradient variant="accentTopCenter" />
      <div className={styles.inner}>
        <h2 className={styles.headline}>{headline}</h2>
        <p className={styles.body}>{body}</p>
        <div className={styles.ctaRow}>
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noreferrer"
            className={styles.primaryCta}
          >
            {ctaLabel} →
          </a>
        </div>
        <p className={styles.meta}>
          30 minutes, no cost, with the person who builds Scamp.
        </p>
      </div>
    </section>
  );
}
