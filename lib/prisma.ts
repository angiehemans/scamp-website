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

// Runtime detection, and it has to be right: picking the TCP adapter on Workers
// makes every query fail with an unexplained 500, because Workers have no TCP
// sockets.
//
// `navigator.userAgent === "Cloudflare-Workers"` is the documented signal, but
// it is not sufficient here — `nodejs_compat` is enabled, and Node 21+ defines
// its own `navigator` with `userAgent` of "Node.js/<version>". If that shadows
// the Workers value, this silently chooses the wrong adapter.
//
// `WebSocketPair` is a Workers-only global that nodejs_compat does not provide,
// so it is checked as well. Either signal is enough.
const isWorkers =
  (typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers") ||
  typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !==
    "undefined";

function createClient() {
  const connectionString = requireDatabaseUrl();

  // Logged deliberately, and worth keeping. A wrong adapter choice shows up as
  // an empty 500 on every database-touching request with nothing in the
  // response to explain it; this line makes `wrangler tail` say which path was
  // taken. Contains no secrets.
  console.log(
    `[prisma] runtime=${isWorkers ? "workers" : "node"} adapter=${isWorkers ? "neon" : "pg"}`,
  );

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
