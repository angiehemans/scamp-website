import { PLATFORMS, type Platform } from "@/lib/platforms";

/**
 * Reads for the current shipped release, straight from the app's update feed.
 *
 * The desktop app updates itself from `updates.scamp.club` (electron-updater's
 * generic provider), and every release lands there as one manifest per
 * platform. Reading the same manifests here means the website can never serve
 * an older build than the one the app would update to — there is no second
 * publish step to forget.
 *
 * Fetched with `no-store` on every call. The manifests are a few hundred bytes,
 * and caching them would reintroduce exactly the lag this exists to remove.
 */

export const UPDATE_FEED = "https://updates.scamp.club";

/** Feed manifest and the installer extension to serve, per platform. */
const FEED: Record<Platform, { manifest: string; ext: string }> = {
  macos: { manifest: "latest-mac.yml", ext: ".dmg" },
  windows: { manifest: "latest.yml", ext: ".exe" },
  linux: { manifest: "latest-linux.yml", ext: ".AppImage" },
};

export interface ResolvedAsset {
  version: string;
  /** Absolute URL of the installer on the update feed. */
  url: string;
  filename: string;
  sizeBytes: number | null;
}

/**
 * Pulls `version` and the `files[].url` / `size` pairs out of an
 * electron-builder manifest. Its shape is fixed by electron-builder, so a
 * line-based read is enough and avoids a YAML dependency for three fields.
 */
function parseManifest(
  text: string,
): { version: string; files: { url: string; size: number | null }[] } | null {
  const version = text.match(/^version:\s*['"]?([^'"\s]+)/m)?.[1];
  if (!version) return null;

  const files: { url: string; size: number | null }[] = [];
  for (const line of text.split("\n")) {
    const url = line.match(/^\s*-\s*url:\s*['"]?([^'"\n]+?)['"]?\s*$/)?.[1];
    if (url) {
      files.push({ url, size: null });
      continue;
    }
    const size = line.match(/^\s+size:\s*(\d+)/)?.[1];
    const last = files[files.length - 1];
    if (size && last && last.size === null) last.size = Number(size);
  }
  return { version, files };
}

/**
 * The installer to serve for a platform right now, or null.
 *
 * Null covers "the feed is unreachable", "no manifest for this platform", and
 * "the manifest has no installer of the right type" — the caller's response is
 * the same for all three.
 */
export async function getDownloadAsset(
  platform: Platform,
): Promise<ResolvedAsset | null> {
  const { manifest, ext } = FEED[platform];

  let text: string;
  try {
    const res = await fetch(`${UPDATE_FEED}/${manifest}`, { cache: "no-store" });
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null;
  }

  const parsed = parseManifest(text);
  const file = parsed?.files.find((f) => f.url.endsWith(ext));
  if (!parsed || !file) return null;

  return {
    version: parsed.version,
    url: `${UPDATE_FEED}/${encodeURIComponent(file.url)}`,
    filename: file.url,
    sizeBytes: file.size,
  };
}

export interface CurrentRelease {
  version: string;
  platforms: Platform[];
}

/**
 * The newest version on the feed and which platforms have a build of it.
 *
 * Platforms can briefly disagree mid-release (each manifest is uploaded as its
 * build finishes), so the headline version is the highest one seen. Every
 * listed platform still downloads its own latest build.
 */
export async function getCurrentRelease(): Promise<CurrentRelease | null> {
  const assets = await Promise.all(
    PLATFORMS.map(async (p) => ({
      slug: p.slug,
      asset: await getDownloadAsset(p.slug),
    })),
  );

  const available = assets.filter((a) => a.asset !== null);
  if (available.length === 0) return null;

  const version = available
    .map((a) => a.asset!.version)
    .sort(compareVersions)
    .at(-1)!;

  return { version, platforms: available.map((a) => a.slug) };
}

/** Numeric semver compare. "0.10.0" > "0.9.0", which a string sort gets wrong. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = b.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
