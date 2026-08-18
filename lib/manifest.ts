/**
 * A manifest is the complete state of a project at one moment: a map of
 * relative path → sha256 of that file's content. It is what a version *is*
 * (see plans/cloud-backup.md) — storing one is a row, not a copy.
 */
export type Manifest = Record<string, string>;

/**
 * Caps. These are abuse limits, not product limits — a legitimate project is
 * hundreds of files. Hitting the file cap almost always means the client's
 * ignore rules are not working, so the error says so: `node_modules` alone is
 * ~68,000 files.
 */
export const MAX_FILES = 20_000;
export const MAX_PATH_LENGTH = 1_024;

const SHA256 = /^[a-f0-9]{64}$/;

/**
 * Paths are stored verbatim and later written to disk by the client, so an
 * unsafe path here becomes a path traversal there. Reject anything that is not
 * a plain relative path, regardless of what the client claims.
 */
function pathProblem(path: string): string | null {
  if (path.length === 0) return "empty path";
  if (path.length > MAX_PATH_LENGTH) return `path longer than ${MAX_PATH_LENGTH}`;
  if (path.startsWith("/")) return "absolute path";
  if (/^[a-zA-Z]:/.test(path)) return "drive-letter path";
  if (path.includes("\\")) return "backslash in path";
  if (path.split("/").some((seg) => seg === "..")) return "path escapes project";
  if (path.split("/").some((seg) => seg === "." || seg === "")) {
    return "empty or '.' path segment";
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(path)) return "control character in path";
  return null;
}

export interface ManifestValidation {
  ok: boolean;
  error?: string;
  /** Unique content hashes, deduplicated — two paths may share content. */
  hashes: string[];
}

export function validateManifest(value: unknown): ManifestValidation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "manifest must be an object", hashes: [] };
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_FILES) {
    return {
      ok: false,
      error:
        `manifest has ${entries.length} files, over the ${MAX_FILES} limit. ` +
        "This usually means ignore rules are not being applied — node_modules " +
        "alone is around 68,000 files.",
      hashes: [],
    };
  }

  const hashes = new Set<string>();
  for (const [path, hash] of entries) {
    const problem = pathProblem(path);
    if (problem) {
      return { ok: false, error: `invalid path ${JSON.stringify(path)}: ${problem}`, hashes: [] };
    }
    if (typeof hash !== "string" || !SHA256.test(hash)) {
      return {
        ok: false,
        error: `invalid hash for ${JSON.stringify(path)}: expected a sha256 hex digest`,
        hashes: [],
      };
    }
    hashes.add(hash);
  }

  return { ok: true, hashes: [...hashes] };
}
