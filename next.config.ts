import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Whole site is prerenderable, so emit a pure static export (`out/`) that
  // Cloudflare serves directly as assets — no Worker runtime in the request path.
  output: "export",
  images: {
    // Static export has no server image optimizer; serve the (pre-compressed)
    // source files from /public as-is.
    unoptimized: true,
  },
};

export default nextConfig;
