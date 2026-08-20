import { getPrisma } from "@/lib/prisma";
import { blobKey, blobStore } from "@/lib/blob-store";
import { validateManifest, type Manifest } from "@/lib/manifest";
import {
  checkCanSync,
  badRequest,
  currentApiUser,
  notFound,
  syncDenied,
  unauthorized,
} from "@/lib/api-auth";

/**
 * Step 3 of a push: record the manifest as a version.
 *
 * Every hash is verified to actually exist in R2 first. Without that a client
 * could commit a manifest referencing content it never uploaded, and the
 * failure would not surface until someone tried to restore — which is the
 * worst possible moment to discover a backup is incomplete.
 *
 * Sizes are read from R2 rather than taken from the client, so storage
 * accounting cannot be misreported.
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

  const { manifest, deviceId } = (body ?? {}) as {
    manifest?: unknown;
    deviceId?: unknown;
  };

  const validation = validateManifest(manifest);
  if (!validation.ok) return badRequest(validation.error!);
  if (deviceId !== undefined && typeof deviceId !== "string") {
    return badRequest("deviceId must be a string");
  }

  // Verify every referenced blob is really there, and collect sizes.
  const sizes = new Map<string, number>();
  const missing: string[] = [];
  await Promise.all(
    validation.hashes.map(async (hash) => {
      const meta = await blobStore.head(blobKey(user.id, project.id, hash));
      if (meta === null) missing.push(hash);
      else sizes.set(hash, meta.size);
    }),
  );

  if (missing.length > 0) {
    return Response.json(
      {
        error: "Cannot commit: some content was never uploaded",
        missing: missing.slice(0, 20),
        missingCount: missing.length,
      },
      { status: 409 },
    );
  }

  const typed = manifest as Manifest;
  const fileCount = Object.keys(typed).length;
  const totalBytes = Object.values(typed).reduce(
    (sum, hash) => sum + (sizes.get(hash) ?? 0),
    0,
  );

  // Sequential rather than a transaction: the Neon HTTP driver used on Workers
  // cannot open one, and an interactive `getPrisma().$transaction` fails there with
  // "Transactions are not supported in HTTP mode" while passing locally on the
  // TCP adapter.
  //
  // The order is chosen so that any partial failure is harmless rather than
  // corrupting:
  //
  //   1. Blob size rows — accounting only, and idempotent via skipDuplicates.
  //      Orphaned rows describe content that really is in R2, so they are at
  //      worst slightly early.
  //   2. The version — the row that makes the push "real". Nothing references
  //      a version that was never created.
  //   3. updatedAt — cosmetic.
  //
  // Failing before step 2 means the push simply did not happen, and the client
  // retries. There is no state in which a version exists whose content is
  // unaccounted for.
  await getPrisma().blob.createMany({
    data: validation.hashes.map((hash) => ({
      projectId: project.id,
      hash,
      size: sizes.get(hash) ?? 0,
    })),
    skipDuplicates: true,
  });

  const version = await getPrisma().projectVersion.create({
    data: {
      projectId: project.id,
      manifest: typed,
      fileCount,
      totalBytes: BigInt(totalBytes),
      deviceId: typeof deviceId === "string" ? deviceId : null,
    },
  });

  await getPrisma().project.update({
    where: { id: project.id },
    data: { updatedAt: new Date() },
  });

  return Response.json(
    {
      versionId: version.id,
      createdAt: version.createdAt.toISOString(),
      fileCount,
      totalBytes,
    },
    { status: 201 },
  );
}
