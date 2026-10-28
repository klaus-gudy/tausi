import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // "Stock in & out" was split into the Inventory pages; old links land on
  // the matching one. app/(core)/stock keeps the actions and dialogs they
  // share, with no page of its own.
  async redirects() {
    return [
      {
        source: "/stock",
        has: [{ type: "query", key: "tab", value: "movements" }],
        destination: "/movement-history",
        permanent: false,
      },
      { source: "/stock", destination: "/stock-on-hand", permanent: false },
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
