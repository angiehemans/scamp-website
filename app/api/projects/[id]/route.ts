import { prisma } from "@/lib/prisma";
import { blobStore, projectPrefix } from "@/lib/blob-store";
import {
  checkCanSync,
  badRequest,
  currentApiUser,
  notFound,
  syncDenied,
  unauthorized,
} from "@/lib/api-auth";
import type { User } from "@/lib/generated/prisma/client";

const MAX_NAME_LENGTH = 200;

/**
 * Loads a project only if it belongs to the caller.
 *
 * Ownership is part of the *query*, not a check after the fact — there is no
 * code path that fetches a project by id alone, so "forgot to check the owner"
 * cannot happen. Callers turn a null into a 404, never a 403, so the response
 * does not reveal whether the id exists.
 */
async function ownedProject(user: User, id: string) {
  return prisma.project.findFirst({ where: { id, userId: user.id } });
}

function serialise(p: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await currentApiUser();
  if (!user) return unauthorized();
  const denied = checkCanSync(user);
  if (denied) return syncDenied(denied);

  const { id } = await params;
  const project = await ownedProject(user, id);
  if (!project) return notFound();

  const [versionCount, stored] = await Promise.all([
    prisma.projectVersion.count({ where: { projectId: project.id } }),
    prisma.blob.aggregate({
      where: { projectId: project.id },
      _sum: { size: true },
    }),
  ]);

  return Response.json({
    project: {
      ...serialise(project),
      versionCount,
      // "Stored", not "used": unlimited history means deleting a file frees
      // nothing, so this only ever grows. Labelling it "used" in the UI would
      // read as a bug.
      storedBytes: stored._sum.size ?? 0,
    },
  });
}

/** Rename. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await currentApiUser();
  if (!user) return unauthorized();
  const denied = checkCanSync(user);
  if (denied) return syncDenied(denied);

  const { id } = await params;
  const project = await ownedProject(user, id);
  if (!project) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON");
  }

  const name = (body as { name?: unknown })?.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    return badRequest("name is required");
  }
  if (name.length > MAX_NAME_LENGTH) {
    return badRequest(`name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { name: name.trim() },
  });

  return Response.json({ project: serialise(updated) });
}

/**
 * Delete a project and everything it stored.
 *
 * This is the only operation that removes blobs. Because content is never
 * deleted when a single file is removed, and blobs are namespaced per project,
 * cleanup is a prefix delete — no reference counting, no sweep job.
 *
 * R2 is cleared before the database row, so a failure leaves rows pointing at
 * objects that are already gone rather than objects with nothing pointing at
 * them. The former is recoverable by retrying the delete; the latter would be
 * an invisible leak.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const user = await currentApiUser();
  if (!user) return unauthorized();
  const denied = checkCanSync(user);
  if (denied) return syncDenied(denied);

  const { id } = await params;
  const project = await ownedProject(user, id);
  if (!project) return notFound();

  const blobsDeleted = await blobStore.deletePrefix(
    projectPrefix(user.id, project.id),
  );

  // Cascades to ProjectVersion and Blob rows.
  await prisma.project.delete({ where: { id: project.id } });

  return Response.json({ deleted: true, blobsDeleted });
}
