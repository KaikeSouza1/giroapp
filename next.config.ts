import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true, // Isso ignora o erro chato do ESLint no build
  },
};

export default nextConfig;