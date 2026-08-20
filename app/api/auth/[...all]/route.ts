import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// Better Auth's endpoints (sign-up, sign-in, sign-out, session) all hang off
// this one catch-all route.
//
// The handler is built inside each request rather than once at module scope.
// On Workers the underlying Prisma client must not outlive the request that
// created it — see getPrisma() — and `toNextJsHandler(auth)` at module scope
// would capture one for the isolate's lifetime.

export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
