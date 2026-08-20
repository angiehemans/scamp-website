/**
 * Config file for `npx @better-auth/cli generate` ONLY.
 *
 * The CLI looks for an exported `auth` instance. The app deliberately does not
 * have one — `lib/auth.ts` exports `getAuth()` instead, because a module-scoped
 * instance pins a Prisma client for the isolate's lifetime and breaks on
 * Cloudflare Workers (see getPrisma()).
 *
 * Constructing one here is safe because nothing in the app imports this file;
 * it is only ever loaded by the CLI, in Node.
 *
 * Usage:
 *   npx @better-auth/cli generate --config better-auth.config.ts
 *
 * ⚠️ The CLI OVERWRITES prisma/schema.prisma and strips `runtime = "workerd"`
 * from the generator block. Check it is still there afterwards, or the next
 * deploy dies with a WebAssembly CompileError.
 */
import { buildAuth } from "@/lib/auth";

export const auth = buildAuth();
