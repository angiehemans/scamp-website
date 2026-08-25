import { getPrisma } from "@/lib/prisma";
import type { Platform } from "@/lib/platforms";

/**
 * Reads for the current shipped release.
 *
 * Every query here filters on `publishedAt != null`. A staged release — one
 * whose assets are uploaded but which has not been made live — must be
 * completely invisible, so that filter belongs in this one module rather than
 * being repeated (and eventually forgotten) at each call site.
 *
 * Ordered by `publishedAt desc`, never by version string: "0.10.0" < "0.9.0"
 * lexicographically, which would quietly serve an older build forever.
 */

export interface CurrentRelease {
  id: string;
  version: string;
  notes: string | null;
  publishedAt: Date;
  platforms: Platform[];
}

export async function getCurrentRelease(): Promise<CurrentRelease | null> {
  const release = await getPrisma().release.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      version: true,
      notes: true,
      publishedAt: true,
      assets: { select: { platform: true } },
    },
  });

  if (!release || !release.publishedAt) return null;

  return {
    id: release.id,
    version: release.version,
    notes: release.notes,
    publishedAt: release.publishedAt,
    platforms: release.assets.map((a) => a.platform as Platform),
  };
}

export interface ResolvedAsset {
  version: string;
  key: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
}

/**
 * The asset to serve for a platform right now, or null.
 *
 * Null covers three different situations on purpose — no release at all, no
 * published release, or a published release that has no build for this platform
 * — because the caller's response is the same for all three and distinguishing
 * them would only leak which case it is.
 */
export async function getDownloadAsset(
  platform: Platform,
): Promise<ResolvedAsset | null> {
  const asset = await getPrisma().releaseAsset.findFirst({
    where: {
      platform,
      release: { publishedAt: { not: null } },
    },
    orderBy: { release: { publishedAt: "desc" } },
    select: {
      key: true,
      filename: true,
      sizeBytes: true,
      sha256: true,
      release: { select: { version: true } },
    },
  });

  if (!asset) return null;

  return {
    version: asset.release.version,
    key: asset.key,
    filename: asset.filename,
    sizeBytes: asset.sizeBytes,
    sha256: asset.sha256,
  };
}
