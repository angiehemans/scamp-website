import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth's endpoints (sign-up, sign-in, sign-out, session) all hang off
// this one catch-all route.
//
// This is the first route handler in the codebase. `output: "export"` made
// route handlers impossible, so the fact that this file works at all is the
// proof that removing it did what was intended.
export const { GET, POST } = toNextJsHandler(auth);
