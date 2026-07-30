import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Whole site is prerenderable, so emit a pure static export (`out/`) that
  // Cloudflare serves directly as assets — no Worker runtime in the request path.
  output: "export",
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
  images: {
    // Static export has no server image optimizer; serve the (pre-compressed)
    // source files from /public as-is.
    unoptimized: true,
  },
};

export default nextConfig;
