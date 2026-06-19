import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
      {
        protocol: "https",
        hostname: "*.tiktokcdn.com",
      },
      {
        protocol: "https",
        hostname: "*.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "*.fbcdn.net",
      },
    ],
  },
  // Note: the marketing landing pages ("/", "/brands", "/creators") are routed
  // by src/middleware.ts, which serves them only on the marketing host and
  // leaves them as real app routes on viewtrackr.com.
  async redirects() {
    return [
      // Deprecated: the old /apply creator page is superseded by /creators.
      // Page code stays in the repo (reversible); traffic goes to the
      // current on-brand creators page + its application form.
      { source: "/apply", destination: "/creators", permanent: false },
    ];
  },
};

export default nextConfig;
