import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.aboutamazon.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.royalmail.com",
        pathname: "/sites/**",
      },
      {
        protocol: "https",
        hostname: "newsroom.tiktok.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cms-assets.publishing.service.gov.uk",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
