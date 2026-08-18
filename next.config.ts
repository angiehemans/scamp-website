import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // No `output: "export"`. That flag is global: it forces every route static and
  // makes route handlers, cookies, and proxy impossible, which auth needs.
  // Without it the App Router classifies each route on its own — the marketing
  // and docs pages under app/(marketing) still prerender to static HTML, and
  // only app/(app) routes are server-rendered. Check the `○ ● ƒ` markers in the
  // build summary if that ever looks wrong.
  // Dev only. `next dev` already binds 0.0.0.0, so a phone on the same Wi-Fi can
  // reach http://<this-machine-lan-ip>:3000 — but Next 403s cross-origin requests
  // to /_next and /__nextjs internals, which kills HMR and the error overlay.
  // Allowlist the private LAN ranges so testing on a real device works.
  // Patterns match per dot-separated segment, so these cover any host on the subnet.
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "*.local", // mDNS, e.g. angies-linux.local
  ],
  // node-postgres is only used by the local Node dev server; the Worker uses
  // @prisma/adapter-neon (see lib/prisma.ts). It still ends up in the bundled
  // server output, and `pg` requires `pg-cloudflare` — whose `workerd` export
  // condition Next's tracer does not follow, so the traced copy arrives without
  // its dist/ and the Worker build fails to resolve it. Force those files in.
  outputFileTracingIncludes: {
    "**": ["./node_modules/pg-cloudflare/dist/**"],
  },
  images: {
    // Static export has no server image optimizer; serve the (pre-compressed)
    // source files from /public as-is.
    unoptimized: true,
  },
};

export default nextConfig;

// Makes the Cloudflare bindings from wrangler.jsonc (ASSETS, IMAGES, the
// self-reference service) available during `next dev`, so local development
// behaves like the deployed Worker. No-op outside dev.
initOpenNextCloudflareForDev();
