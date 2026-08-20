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

// Logged once per isolate, not per client. The line is what identified the
// wrong-adapter bug during the first Cloudflare deploys, so it is worth
// keeping — but clients are now built per request, and logging on every one
// would bury the actual errors.
let loggedAdapter = false;

function createClient() {
  const connectionString = requireDatabaseUrl();

  if (!loggedAdapter) {
    loggedAdapter = true;
    console.log(
      `[prisma] runtime=${isWorkers ? "workers" : "node"} adapter=${isWorkers ? "neon-ws" : "pg"} (per-request=${isWorkers})`,
    );
  }

  if (isWorkers) {
    const {
      PrismaNeon,
    }: typeof import("@prisma/adapter-neon") = require("@prisma/adapter-neon");
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  }

  // Node only. Kept out of the Worker bundle by `outputFileTracingIncludes` in
  // next.config.ts — see the comment there.
  const {
    PrismaPg,
  }: typeof import("@prisma/adapter-pg") = require("@prisma/adapter-pg");
  return new PrismaClient({ adapter: new PrismaPg(connectionString) });
}

// Node caches one client for the process. Next.js hot-reloads modules in
// development, and a fresh client per reload leaks a connection pool each time,
// so it is pinned to globalThis.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * The Prisma client for the current request.
 *
 * ── Why this is a function and not a module-scoped constant ──────────────────
 * On Workers it MUST be per request. Cloudflare binds I/O objects to the
 * request that created them, and the Neon adapter's pooled WebSocket is one:
 * a client cached at module scope outlives its request, and the next request to
 * touch it dies with
 *
 *   Cannot perform I/O on behalf of a different request (I/O type: Native)
 *
 * followed by the Worker hanging until the runtime cancels it. It only bites
 * from the second request an isolate serves, so it reads as intermittent.
 *
 * The HTTP driver (PrismaNeonHttp) avoids that by holding no socket, and was
 * tried here — but it rejects `startTransaction()` unconditionally, so any
 * operation Prisma routes through a transaction fails, including Better Auth's
 * sign-in. Per-request construction is the option that satisfies both.
 *
 * Clients are lazy: no connection opens until the first query, so calling this
 * on a path that never queries costs nothing.
 */
export function getPrisma(): PrismaClient {
  if (isWorkers) return createClient();

  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}
