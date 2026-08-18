import type { Metadata } from "next";

/**
 * Keeps /sign-in, /sign-up and /dashboard out of search results while the cloud
 * features are being tested quietly.
 *
 * `noindex` rather than a robots.txt `Disallow`: a disallowed URL is never
 * crawled, so this tag would never be read, and Google can still list a
 * disallowed URL it finds linked elsewhere. Allowing the crawl and telling it
 * not to index is the reliable way to stay out of results.
 *
 * Nothing links here anyway — the nav, footer, sitemap and llms.txt all omit
 * these routes — so this is the belt to that pair of braces. Remove it when the
 * cloud tier launches publicly.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Authenticated app boundary.
 *
 * Routes in this group are allowed to be dynamic: they read the session, so
 * they render per-request and show as `ƒ` in the build summary. That is
 * expected here and only here.
 *
 * Keep session reads inside this group. Anything auth-aware that leaks into the
 * root layout would opt the marketing pages into dynamic rendering too.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
