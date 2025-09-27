import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Deshabilitar ESLint durante el build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // También podemos ser menos estrictos con TypeScript si es necesario
    // ignoreBuildErrors: true,
  },
};

export default nextConfig;
