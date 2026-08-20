import { getPrisma } from "@/lib/prisma";
import { blobKey, blobStore, usingDirectR2 } from "@/lib/blob-store";
import { validateManifest } from "@/lib/manifest";
import {
  checkCanSync,
  badRequest,
  currentApiUser,
  notFound,
  syncDenied,
  unauthorized,
} from "@/lib/api-auth";

/**
 * Step 1 of a push: the client says what the project contains, the server says
 * what it does not already have.
 *
 * This is where "upload only what changed" happens. The client sends every
 * file's hash; the server answers with upload URLs for the subset it is
 * missing. An unchanged project produces an empty `uploads` object and the
 * push transfers nothing.
 *
 * Ignore rules are *not* applied here. Deciding what belongs in a project is
 * the client's job (see plans/cloud-backup.md); the server only enforces
 * that whatever it is told is well-formed and within limits.
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
  const project = await getPrisma().project.findFirst({
    where: { id, userId: user.id },
  });
  if (!project) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const manifest = (body as { manifest?: unknown })?.manifest;
  const validation = validateManifest(manifest);
  if (!validation.ok) return badRequest(validation.error!);

  const keys = validation.hashes.map((h) => blobKey(user.id, project.id, h));
  const present = await blobStore.hasMany(keys);

  const uploads: Record<string, string> = {};
  await Promise.all(
    validation.hashes.map(async (hash) => {
      const key = blobKey(user.id, project.id, hash);
      if (present.has(key)) return;
      uploads[hash] = await blobStore.presignPut(key);
    }),
  );

  return Response.json({
    uploads,
    have: present.size,
    missing: Object.keys(uploads).length,
    // Tells the client whether it is PUTting to R2 or back through this app.
    // Useful for diagnostics; the client behaves identically either way.
    direct: usingDirectR2(),
  });
}
