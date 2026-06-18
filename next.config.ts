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
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/site/index.html" },
        { source: "/brands", destination: "/site/brands.html" },
        { source: "/creators", destination: "/site/creators.html" },
      ],
    };
  },
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
