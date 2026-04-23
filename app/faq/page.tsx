import type { Metadata } from "next";
import Nav from "@/components/Nav/Nav";
import Footer from "@/components/Footer/Footer";
import FAQ from "@/components/FAQ/FAQ";
import JsonLd from "@/components/JsonLd/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { SITE_NAME } from "@/lib/site";
import { HOMEPAGE_FAQ } from "@/lib/faq-content";

const PAGE_DESCRIPTION =
  "Answers to the most common questions about Scamp: what it is, who it is for, how it compares to Figma, how designers use it with AI, how handoff to developers works, and how to get started.";

export const metadata: Metadata = {
  title: "FAQ",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/faq" },
  openGraph: {
    title: `FAQ — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    url: "/faq",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `FAQ — ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
  },
};

export default function FAQPage() {
  return (
    <>
      <Nav />
      <main>
        <FAQ
          eyebrow="Frequently asked questions"
          headline="Everything people ask about Scamp"
          items={HOMEPAGE_FAQ}
        />
      </main>
      <Footer />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "FAQ", url: "/faq" },
        ])}
      />
    </>
  );
}
