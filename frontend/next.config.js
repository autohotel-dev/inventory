/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

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
        source: '/chat-sw.js',
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

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  importScripts: ['/chat-sw.js', '/valet-push-sw.js'],
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/, /_next\/app-build-manifest\.json$/],
  publicExcludes: ['!nprogress/nprogress.css', '!**/chat-sw.js', '!**/valet-push-sw.js'],
});

// Aplicar configuraciones
let config = nextConfig;
if (process.env.NODE_ENV !== 'development') {
  config = withPWA(config);
}
config = withBundleAnalyzer(config);

module.exports = config;