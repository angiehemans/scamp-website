import { getPrisma } from "@/lib/prisma";
import {
  checkCanSync,
  currentApiUser,
  notFound,
  syncDenied,
  unauthorized,
} from "@/lib/api-auth";

/**
 * The manifest for one version — the complete state of the project at that
 * moment.
 *
 * `?version=<id>` restores a specific point in history; omitting it gives the
 * latest. Restoring an old version is the whole reason history is unlimited, so
 * both paths matter equally.
 */
export async function GET(
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

  const versionId = new URL(request.url).searchParams.get("version");

  // Scoped by projectId as well as id, so a version id from another project
  // cannot be read even by a user who owns both.
  const version = versionId
    ? await getPrisma().projectVersion.findFirst({
        where: { id: versionId, projectId: project.id },
      })
    : await getPrisma().projectVersion.findFirst({
        where: { projectId: project.id },
        orderBy: { createdAt: "desc" },
      });

  if (!version) return notFound();

  return Response.json({
    versionId: version.id,
    createdAt: version.createdAt.toISOString(),
    fileCount: version.fileCount,
    totalBytes: Number(version.totalBytes),
    deviceId: version.deviceId,
    manifest: version.manifest,
  });
}
