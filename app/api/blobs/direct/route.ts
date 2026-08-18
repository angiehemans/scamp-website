import { blobStore, verifyLocalBlobToken } from "@/lib/blob-store";

/**
 * Local-development stand-in for a presigned R2 URL.
 *
 * In production the client PUTs straight to R2 and this route is never called —
 * `presignPut` returns a real presigned URL as soon as the R2 S3 credentials
 * are set. It exists because miniflare emulates the R2 *binding*, not the S3
 * HTTP API, so presigning cannot work against local R2.
 *
 * Authorisation is the HMAC token in the query string, not the session, which
 * mirrors presigned-URL semantics exactly: the URL itself is the capability,
 * it covers one key, and it expires. That keeps the client protocol identical
 * across both environments.
 */

function parse(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return null;
  const ok = verifyLocalBlobToken(
    key,
    url.searchParams.get("expires"),
    url.searchParams.get("sig"),
  );
  return ok ? key : null;
}

export async function PUT(request: Request) {
  const key = parse(request);
  if (!key) return new Response("Invalid or expired blob URL", { status: 403 });
  if (!request.body) return new Response("Empty body", { status: 400 });

  await blobStore.put(key, await request.arrayBuffer());
  return new Response(null, { status: 201 });
}

export async function GET(request: Request) {
  const key = parse(request);
  if (!key) return new Response("Invalid or expired blob URL", { status: 403 });

  const body = await blobStore.get(key);
  if (!body) return new Response("Not found", { status: 404 });

  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      // Content-addressed, so the bytes at a key can never change.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
