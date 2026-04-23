import JsonLd from "@/components/JsonLd/JsonLd";
import { faqPageSchema, type FaqItem } from "@/lib/schema";
import styles from "./FAQ.module.css";

interface FAQProps {
  eyebrow?: string;
  headline?: string;
  items: FaqItem[];
  emitJsonLd?: boolean;
}

export default function FAQ({
  eyebrow = "FAQ",
  headline = "Frequently asked questions",
  items,
  emitJsonLd = true,
}: FAQProps) {
  return (
    <section id="faq" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.headline}>{headline}</h2>
        </div>
        <div className={styles.list}>
          {items.map((item, i) => (
            <details key={i} className={styles.item}>
              <summary className={styles.summary}>{item.question}</summary>
              <div className={styles.answer}>
                {item.answer.split("\n\n").map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
      {emitJsonLd && <JsonLd data={faqPageSchema(items)} />}
    </section>
  );
}
