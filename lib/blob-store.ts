import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AwsClient } from "aws4fetch";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Content-addressed blob storage for project backup & sync.
 * See plans/cloud-backup.md.
 *
 * Blobs are immutable and keyed by the sha256 of their own content, namespaced
 * per project:
 *
 *     blobs/<userId>/<projectId>/<sha256>
 *
 * The namespacing is what removes garbage collection from the design: content
 * is never deleted when a file is removed (unlimited history), so deleting a
 * project or account is a prefix delete and nothing is ever orphaned. It also
 * contains the blast radius of a bad hash — a client can only write into its
 * own project's prefix, which matters because uploads go straight to R2 and the
 * server never sees the bytes to verify them.
 *
 * ── Why there are two implementations ────────────────────────────────────────
 * Presigned URLs are an S3-API feature. They need R2's real S3 endpoint and
 * credentials, and miniflare emulates the Workers *binding*, not the S3 HTTP
 * API — so presigning cannot work against local R2.
 *
 * Both implementations therefore return an opaque URL that the client PUTs to.
 * The client cannot tell them apart:
 *
 *   production  → a genuine presigned R2 URL; bytes never touch the Worker
 *   local dev   → a URL back to this app, HMAC-signed and short-lived, whose
 *                 route writes through the R2 binding
 *
 * Same protocol either way, so the client is written once.
 */

export const BLOB_URL_TTL_SECONDS = 60 * 15;

export function blobKey(
  userId: string,
  projectId: string,
  hash: string,
): string {
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error(`Not a sha256 hex digest: ${hash}`);
  }
  return `blobs/${userId}/${projectId}/${hash}`;
}

export interface BlobStore {
  /** Which of these keys are already stored. Drives "upload only what changed". */
  hasMany(keys: string[]): Promise<Set<string>>;
  /** Size of a stored blob, or null if absent. Sizes come from R2, never from
   *  the client, so storage accounting cannot be misreported. */
  head(key: string): Promise<{ size: number } | null>;
  /** An opaque URL the client can PUT raw bytes to. */
  presignPut(key: string): Promise<string>;
  /**
   * An opaque URL the client can GET raw bytes from.
   *
   * `filename` makes the response download under that name instead of the
   * object key. Used for release installers, where the key is an internal
   * layout detail but the saved file needs to read as `Scamp-0.6.0.dmg`.
   */
  presignGet(key: string, filename?: string): Promise<string>;
  /** Direct write. Used by the local upload route; not part of the client protocol. */
  put(key: string, body: ReadableStream | ArrayBuffer): Promise<void>;
  /** Direct read. Used by the local download route. */
  get(key: string): Promise<ReadableStream | null>;
  /** Removes everything under a prefix. Used when deleting a project. */
  deletePrefix(prefix: string): Promise<number>;
}

async function bucket() {
  const { env } = await getCloudflareContext({ async: true });
  const b = env.BLOBS;
  if (!b) {
    throw new Error(
      "R2 binding BLOBS is missing. Check r2_buckets in wrangler.jsonc, and " +
        "that initOpenNextCloudflareForDev() is called in next.config.ts.",
    );
  }
  return b;
}

/** R2 has no bulk `head`, so this is one call per key — fine at project scale. */
async function hasMany(keys: string[]): Promise<Set<string>> {
  const b = await bucket();
  const found = new Set<string>();
  const results = await Promise.all(
    keys.map(async (k) => [k, (await b.head(k)) !== null] as const),
  );
  for (const [k, present] of results) if (present) found.add(k);
  return found;
}

async function head(key: string): Promise<{ size: number } | null> {
  const b = await bucket();
  const obj = await b.head(key);
  return obj ? { size: obj.size } : null;
}

async function put(
  key: string,
  body: ReadableStream | ArrayBuffer,
): Promise<void> {
  const b = await bucket();
  await b.put(key, body);
}

async function get(key: string): Promise<ReadableStream | null> {
  const b = await bucket();
  const obj = await b.get(key);
  return obj ? obj.body : null;
}

// ── local dev: HMAC-signed URLs back to this app ─────────────────────────────

function signingSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return secret;
}

function sign(key: string, expires: number): string {
  return createHmac("sha256", signingSecret())
    .update(`${key}:${expires}`)
    .digest("hex");
}

/**
 * Verifies a local blob URL token. Returns the key, or null.
 *
 * The token is a capability, exactly like a presigned URL: holding it grants
 * access to that one key until it expires, and nothing else.
 */
export function verifyLocalBlobToken(
  key: string,
  expires: string | null,
  signature: string | null,
): boolean {
  if (!expires || !signature) return false;
  const exp = Number(expires);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;

  const expected = Buffer.from(sign(key, exp), "utf8");
  const given = Buffer.from(signature, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function localUrl(key: string, filename?: string): string {
  const expires = Math.floor(Date.now() / 1000) + BLOB_URL_TTL_SECONDS;
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({
    key,
    expires: String(expires),
    sig: sign(key, expires),
  });
  // Outside the signature on purpose: it only affects the response's
  // Content-Disposition, not which bytes are served, so tampering with it
  // cannot reach a key the token does not already cover.
  if (filename) params.set("filename", filename);
  return `${base}/api/blobs/direct?${params}`;
}

// ── production: genuine presigned R2 URLs ────────────────────────────────────

function r2Config() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!accessKeyId || !secretAccessKey || !accountId || !bucketName) return null;
  return { accessKeyId, secretAccessKey, accountId, bucketName };
}

async function presignR2(
  key: string,
  method: "PUT" | "GET",
  filename?: string,
): Promise<string | null> {
  const cfg = r2Config();
  if (!cfg) return null;

  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    service: "s3",
    region: "auto",
  });

  const url = new URL(
    `https://${cfg.bucketName}.${cfg.accountId}.r2.cloudflarestorage.com/${key}`,
  );
  url.searchParams.set("X-Amz-Expires", String(BLOB_URL_TTL_SECONDS));
  // Signed along with everything else — S3 covers query parameters in the
  // signature, so this cannot be altered after the fact.
  if (filename) {
    url.searchParams.set(
      "response-content-disposition",
      `attachment; filename="${filename.replace(/"/g, "")}"`,
    );
  }

  const signed = await client.sign(url.toString(), {
    method,
    aws: { signQuery: true },
  });
  return signed.url;
}

/**
 * Deletes every blob under a prefix. This is how a project or account is
 * removed: because content is never deleted when a single file is removed
 * (unlimited history) and blobs are namespaced per project, a prefix delete is
 * the whole cleanup story — there is no reference counting and no GC job.
 *
 * R2 has no native prefix delete, so this lists and deletes in pages.
 */
async function deletePrefix(prefix: string): Promise<number> {
  const b = await bucket();
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const listing = await b.list({ prefix, cursor, limit: 1000 });
    const keys = listing.objects.map((o) => o.key);
    if (keys.length > 0) {
      await b.delete(keys);
      deleted += keys.length;
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  return deleted;
}

export function projectPrefix(userId: string, projectId: string): string {
  return `blobs/${userId}/${projectId}/`;
}

export const blobStore: BlobStore = {
  deletePrefix,
  hasMany,
  head,
  put,
  get,
  // Prefer real presigned URLs; fall back to the local route when R2 S3
  // credentials are absent, which is the case in development.
  async presignPut(key) {
    return (await presignR2(key, "PUT")) ?? localUrl(key);
  },
  async presignGet(key, filename) {
    return (await presignR2(key, "GET", filename)) ?? localUrl(key, filename);
  },
};

/** True when uploads go straight to R2 rather than through this app. */
export function usingDirectR2(): boolean {
  return r2Config() !== null;
}
