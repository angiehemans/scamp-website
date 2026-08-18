/**
 * Marketing + docs boundary.
 *
 * Everything under this group must stay statically prerendered — it is the
 * public site. Nothing here may read cookies, headers, or the session, since
 * any of those opts the whole subtree into dynamic rendering and turns the
 * build markers from `○`/`●` into `ƒ`.
 *
 * Auth-aware UI belongs in app/(app) instead. Route groups do not affect URLs,
 * so these pages are still served from `/`, `/pricing`, `/docs/...` and so on.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
