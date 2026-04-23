// Central site metadata. SITE_URL is used for canonical URLs, OG tags,
// sitemap, and JSON-LD. Set NEXT_PUBLIC_SITE_URL in your deployment env
// (wrangler.jsonc `vars` or Cloudflare dashboard) to match your actual domain.
const FALLBACK_URL = "https://scampdesign.app";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_URL
).replace(/\/$/, "");

export const SITE_NAME = "Scamp";

export const SITE_TAGLINE =
  "A Figma alternative for designers. Full visual and CSS control. Hand off real code.";

export const SITE_DESCRIPTION =
  "Scamp is a free, open-source Figma alternative built for designers. Craft pixel-perfect layouts with full visual and CSS control on a local canvas, use AI coding agents directly on your real design files, and hand off production-ready TSX and CSS — not a static mockup.";

export const SITE_KEYWORDS = [
  "Figma alternative",
  "design tool for designers",
  "design tool with full CSS control",
  "design to code",
  "open source design tool",
  "local-first design tool",
  "designer handoff to developers",
  "AI design tool",
  "design with AI agents",
  "visual CSS editor",
  "TSX design tool",
  "CSS Modules generator",
];

export const GITHUB_URL = "https://github.com/angiehemans/scamp";
export const GITHUB_ISSUES_URL = "https://github.com/angiehemans/scamp/issues";
export const GUMROAD_URL = "https://angiehemans.gumroad.com/l/scamp";

export const OG_IMAGE = "/scamp.png";
export const OG_IMAGE_WIDTH = 2805;
export const OG_IMAGE_HEIGHT = 1690;

export const OWNER_NAME = "Angie Hemans";
