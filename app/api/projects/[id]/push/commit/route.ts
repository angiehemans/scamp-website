import { prisma } from "@/lib/prisma";
import { blobKey, blobStore } from "@/lib/blob-store";
import { validateManifest, type Manifest } from "@/lib/manifest";
import {
  assertCanSync,
  badRequest,
  currentApiUser,
  notFound,
  paymentRequired,
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
  if (!assertCanSync(user)) return paymentRequired();

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

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.projectVersion.create({
      data: {
        projectId: project.id,
        manifest: typed,
        fileCount,
        totalBytes: BigInt(totalBytes),
        deviceId: typeof deviceId === "string" ? deviceId : null,
      },
    });

    // Record blob sizes so storage totals can be shown without listing R2.
    // createMany + skipDuplicates because most hashes already exist from
    // earlier versions — that is the whole point of content addressing.
    await tx.blob.createMany({
      data: validation.hashes.map((hash) => ({
        projectId: project.id,
        hash,
        size: sizes.get(hash) ?? 0,
      })),
      skipDuplicates: true,
    });

    await tx.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    });

    return created;
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
