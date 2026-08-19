import { prisma } from "@/lib/prisma";
import { blobKey, blobStore } from "@/lib/blob-store";
import { MAX_FILES } from "@/lib/manifest";
import {
  checkCanSync,
  badRequest,
  currentApiUser,
  notFound,
  syncDenied,
  unauthorized,
} from "@/lib/api-auth";

const SHA256 = /^[a-f0-9]{64}$/;

/**
 * Download URLs for a batch of hashes — the mirror of push/prepare.
 *
 * Batched rather than one redirect per blob so restoring a 300-file project is
 * two API calls plus N direct transfers, not 300 API calls plus N transfers.
 *
 * The client sends only the hashes it does not already have on disk, so a
 * partially-complete restore resumes rather than starting over.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentApiUser();
  if (!user) return unauthorized();
  const denied = checkCanSync(user);
  if (denied) return syncDenied(denied);

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
  });
  if (!project) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const hashes = (body as { hashes?: unknown })?.hashes;
  if (!Array.isArray(hashes)) return badRequest("hashes must be an array");
  if (hashes.length > MAX_FILES) {
    return badRequest(`too many hashes, limit is ${MAX_FILES}`);
  }
  if (!hashes.every((h) => typeof h === "string" && SHA256.test(h))) {
    return badRequest("every hash must be a sha256 hex digest");
  }

  const unique = [...new Set(hashes as string[])];

  // Only hand out URLs for content that is really there. Signing a URL for an
  // absent blob would give the client a 404 at transfer time with no
  // explanation; reporting it here says plainly which content is missing.
  const keys = unique.map((h) => blobKey(user.id, project.id, h));
  const present = await blobStore.hasMany(keys);

  const downloads: Record<string, string> = {};
  const missing: string[] = [];
  await Promise.all(
    unique.map(async (hash) => {
      const key = blobKey(user.id, project.id, hash);
      if (!present.has(key)) {
        missing.push(hash);
        return;
      }
      downloads[hash] = await blobStore.presignGet(key);
    }),
  );

  return Response.json({ downloads, missing });
}
