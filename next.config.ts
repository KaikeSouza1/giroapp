import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // REMOVIDO: output: 'export' — incompatível com API routes dinâmicas
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;