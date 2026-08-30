import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Album art comes from Apple's CDN and nowhere else.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.mzstatic.com" }],
  },
};

export default nextConfig;
