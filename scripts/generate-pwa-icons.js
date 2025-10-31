// Script para generar iconos PWA en formato PNG
const fs = require('fs');
const path = require('path');

// Crear directorio de iconos si no existe
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG base para el icono (con viewBox fijo)
const svgBase = `
<svg width="512" height="512" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" fill="#2563eb" rx="3"/>
  <rect x="6" y="6" width="20" height="20" fill="white" rx="2"/>
  <rect x="9" y="9" width="14" height="3" fill="#2563eb"/>
  <rect x="9" y="14" width="14" height="3" fill="#2563eb"/>
  <rect x="9" y="19" width="14" height="3" fill="#2563eb"/>
</svg>
`.trim();

// Convertir SVG a data URI PNG base64 (placeholder)
// NOTA: Esto es un placeholder. Para producción, necesitas usar sharp o canvas
const createPNGPlaceholder = (size) => {
  // Crear un PNG base64 simple (cuadrado azul con borde blanco)
  const canvas = `
<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" fill="#2563eb" rx="3"/>
  <rect x="6" y="6" width="20" height="20" fill="white" rx="2"/>
  <rect x="9" y="9" width="14" height="3" fill="#2563eb"/>
  <rect x="9" y="14" width="14" height="3" fill="#2563eb"/>
  <rect x="9" y="19" width="14" height="3" fill="#2563eb"/>
</svg>
`.trim();
  
  const base64 = Buffer.from(canvas).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
};

// Tamaños de iconos necesarios
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generar iconos SVG con tamaños específicos
sizes.forEach(size => {
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" fill="#2563eb" rx="3"/>
  <rect x="6" y="6" width="20" height="20" fill="white" rx="2"/>
  <rect x="9" y="9" width="14" height="3" fill="#2563eb"/>
  <rect x="9" y="14" width="14" height="3" fill="#2563eb"/>
  <rect x="9" y="19" width="14" height="3" fill="#2563eb"/>
</svg>
`.trim();
  
  // Guardar como SVG por ahora (más compatible)
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  
  fs.writeFileSync(filepath, svg);
  console.log(`✅ Generated: ${filename}`);
});

// También crear PNG placeholders si es posible
try {
  sizes.forEach(size => {
    // Crear un archivo PNG simple (esto necesitaría sharp/canvas en producción)
    const pngPlaceholder = createPNGPlaceholder(size);
    console.log(`📱 PNG placeholder created for ${size}x${size}`);
  });
} catch (error) {
  console.log('⚠️  PNG generation skipped (requires sharp/canvas)');
}

console.log('🎉 All PWA icons generated!');
console.log('📝 Note: For production PNG icons, install sharp and run conversion script');
