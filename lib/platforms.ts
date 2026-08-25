/**
 * The platforms Scamp ships for.
 *
 * One list, shared by the publish script, the download route, and the
 * dashboard, so the three can never disagree about what "linux" is called.
 *
 * These are the *slugs* used in URLs and in the database, deliberately kept
 * apart from the installer filenames — `Scamp-0.6.0-arm64.dmg` changes every
 * release, `/api/download/macos` must not.
 */

export const PLATFORMS = [
  { slug: "macos", label: "macOS" },
  { slug: "windows", label: "Windows" },
  { slug: "linux", label: "Linux" },
] as const;

export type Platform = (typeof PLATFORMS)[number]["slug"];

export const PLATFORM_SLUGS = PLATFORMS.map((p) => p.slug) as readonly string[];

export function isPlatform(value: string): value is Platform {
  return PLATFORM_SLUGS.includes(value);
}

export function platformLabel(slug: string): string {
  return PLATFORMS.find((p) => p.slug === slug)?.label ?? slug;
}

/**
 * Where a release asset lives in R2.
 *
 *     releases/<version>/<platform>/<filename>
 *
 * Deliberately NOT content-addressed, unlike project blobs. There are a handful
 * of these, they are ~100 MB each, and a human needs to be able to look at the
 * bucket and understand what is in it. Content addressing buys deduplication
 * that does not apply — two releases never share an installer.
 */
export function releaseKey(
  version: string,
  platform: string,
  filename: string,
): string {
  return `releases/${version}/${platform}/${filename}`;
}

/** Everything belonging to one release, for cleanup. */
export function releasePrefix(version: string): string {
  return `releases/${version}/`;
}
