import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Done here rather than in app/page.tsx: a redirect() in a page throws
  // during dev prerender validation and floods the log with errors.
  redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
