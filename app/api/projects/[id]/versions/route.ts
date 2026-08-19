import { prisma } from "@/lib/prisma";
import {
  checkCanSync,
  currentApiUser,
  notFound,
  syncDenied,
  unauthorized,
} from "@/lib/api-auth";

const MAX_PAGE = 100;

/**
 * Version history for a project, newest first.
 *
 * History is unlimited by design (Decision F), so this is paginated rather than
 * returning everything. Manifests are deliberately excluded — they can be large
 * and are fetched one at a time from the manifest endpoint.
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
  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
  });
  if (!project) return notFound();

  const url = new URL(request.url);
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? 50) || 50,
    MAX_PAGE,
  );
  const before = url.searchParams.get("before");

  const versions = await prisma.projectVersion.findMany({
    where: {
      projectId: project.id,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      fileCount: true,
      totalBytes: true,
      deviceId: true,
    },
  });

  return Response.json({
    versions: versions.map((v) => ({
      id: v.id,
      createdAt: v.createdAt.toISOString(),
      fileCount: v.fileCount,
      // BigInt does not survive JSON.stringify.
      totalBytes: Number(v.totalBytes),
      deviceId: v.deviceId,
    })),
  });
}
