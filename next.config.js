// Temporarily disable next-intl plugin
// const withNextIntl = require('next-intl/plugin')('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Deshabilitar ESLint durante el build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // También podemos ser menos estrictos con TypeScript si es necesario
    // ignoreBuildErrors: true,
  },
};

// module.exports = withNextIntl(nextConfig);
module.exports = nextConfig;
