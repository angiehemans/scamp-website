import { PrismaClient } from "./generated/prisma/client";

// Prisma 7 dropped the Rust query engine, so a driver adapter is mandatory —
// `new PrismaClient()` with no adapter throws at construction.
//
// Which adapter depends on the runtime, and the two are not interchangeable:
//
//   Node (next dev, next build)  -> @prisma/adapter-pg, plain Postgres over TCP.
//                                   Works against the local `prisma dev` server
//                                   and against Neon.
//   Cloudflare Workers           -> @prisma/adapter-neon, which talks to Neon
//                                   over WebSockets/HTTP. Required because the
//                                   Workers runtime has no raw TCP sockets, so
//                                   node-postgres cannot run there at all.
//
// The imports are deliberately lazy (`require` inside the branch) so bundling
// for Workers does not pull node-postgres and its Node built-ins into the
// Worker, and so local dev does not need the Neon driver.
function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Locally: copy .env.example to .env, start the " +
        "database with `npx prisma dev -n scamp -d`, and paste the URL from " +
        "`npx prisma dev ls`. On Cloudflare: set it with `wrangler secret put`.",
    );
  }
  return url;
}

// `navigator.userAgent` is the documented way to detect the Workers runtime.
const isWorkers =
  typeof navigator !== "undefined" &&
  navigator.userAgent === "Cloudflare-Workers";

function createClient() {
  const connectionString = requireDatabaseUrl();

  if (isWorkers) {
    // Static specifier: this one must end up in the Worker bundle.
    const {
      PrismaNeon,
    }: typeof import("@prisma/adapter-neon") = require("@prisma/adapter-neon");
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  }

  // Node only. Kept out of the Worker bundle by `serverExternalPackages` plus
  // `outputFileTracingExcludes` in next.config.ts — see the comment there for
  // why node-postgres cannot be allowed into the Worker build at all.
  const {
    PrismaPg,
  }: typeof import("@prisma/adapter-pg") = require("@prisma/adapter-pg");
  return new PrismaClient({ adapter: new PrismaPg(connectionString) });
}

// Next.js hot-reloads modules in development, and a fresh client per reload
// leaks a connection pool each time until the database refuses new connections.
// Cache on globalThis so reloads reuse one. Production evaluates this once.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
