import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Keep search engines away from every address except the real site
  // (preview.motoringcentral.co.uk, *.vercel.app, localhost). At launch, motoringcentral.co.uk is indexed normally.
  headers() {
    return [
      {
        source: "/:path*",
        missing: [{ type: "host", value: "(www\\.)?motoringcentral\\.co\\.uk" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
