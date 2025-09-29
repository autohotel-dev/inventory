/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Deshabilitar ESLint durante el build para evitar errores en Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignorar errores de TypeScript durante el build si es necesario
    ignoreBuildErrors: false,
  },
  // Optimizaciones para producción
  compress: true,
  poweredByHeader: false,
  // Configuración para PWA
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Configuración de imágenes
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
  },
  // Variables de entorno públicas
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

module.exports = nextConfig;
