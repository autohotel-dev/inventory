// Script para generar iconos PWA simples
const fs = require('fs');
const path = require('path');

// Crear directorio de iconos si no existe
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG base para el icono
const createSVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#2563eb" rx="${size * 0.1}"/>
  <rect x="${size * 0.2}" y="${size * 0.2}" width="${size * 0.6}" height="${size * 0.6}" fill="white" rx="${size * 0.05}"/>
  <rect x="${size * 0.3}" y="${size * 0.3}" width="${size * 0.4}" height="${size * 0.1}" fill="#2563eb"/>
  <rect x="${size * 0.3}" y="${size * 0.45}" width="${size * 0.4}" height="${size * 0.1}" fill="#2563eb"/>
  <rect x="${size * 0.3}" y="${size * 0.6}" width="${size * 0.4}" height="${size * 0.1}" fill="#2563eb"/>
</svg>
`.trim();

// Tamaños de iconos necesarios
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generar iconos
sizes.forEach(size => {
  const svg = createSVG(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  
  fs.writeFileSync(filepath, svg);
  console.log(`✅ Generated: ${filename}`);
});

console.log('🎉 All PWA icons generated successfully!');
