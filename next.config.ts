import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // <-- GARANTA QUE ESTA LINHA ESTÁ AQUI
  images: {
    unoptimized: true, // <-- E ESTA TAMBÉM
  },
  // ... resto das suas configs
};

export default nextConfig;