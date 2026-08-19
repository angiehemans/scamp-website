import { prisma } from "@/lib/prisma";
import {
  checkCanSync,
  badRequest,
  currentApiUser,
  syncDenied,
  unauthorized,
} from "@/lib/api-auth";

const MAX_NAME_LENGTH = 200;

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

/** List the caller's projects. Never anyone else's. */
export async function GET() {
  const user = await currentApiUser();
  if (!user) return unauthorized();
  const denied = checkCanSync(user);
  if (denied) return syncDenied(denied);

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json({ projects: projects.map(serialise) });
}

/** Create a project. */
export async function POST(request: Request) {
  const user = await currentApiUser();
  if (!user) return unauthorized();
  const denied = checkCanSync(user);
  if (denied) return syncDenied(denied);

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

  const project = await prisma.project.create({
    data: { userId: user.id, name: name.trim() },
  });

  return Response.json({ project: serialise(project) }, { status: 201 });
}
