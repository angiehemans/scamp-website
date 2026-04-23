import {
  SITE_URL,
  SITE_NAME,
  SITE_DESCRIPTION,
  GITHUB_URL,
  OWNER_NAME,
  OG_IMAGE,
} from "./site";

const abs = (pathOrUrl: string) =>
  pathOrUrl.startsWith("http") ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: abs(OG_IMAGE),
    sameAs: [GITHUB_URL],
    founder: { "@type": "Person", name: OWNER_NAME },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
  };
}

export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "DesignApplication",
    applicationSubCategory: "Figma alternative",
    operatingSystem: "macOS, Windows, Linux",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    image: abs(OG_IMAGE),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    license: "https://mariadb.com/bsl11/",
    isAccessibleForFree: true,
    softwareHelp: { "@type": "CreativeWork", url: `${SITE_URL}/docs` },
    author: { "@type": "Person", name: OWNER_NAME },
    sameAs: [GITHUB_URL],
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: abs(item.url),
    })),
  };
}

export function articleSchema(opts: {
  title: string;
  description: string | null;
  url: string;
  section?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: opts.title,
    description: opts.description ?? undefined,
    url: abs(opts.url),
    image: abs(OG_IMAGE),
    author: { "@type": "Person", name: OWNER_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: abs(OG_IMAGE) },
    },
    articleSection: opts.section ?? "Documentation",
  };
}
