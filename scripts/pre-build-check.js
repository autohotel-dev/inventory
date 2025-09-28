#!/usr/bin/env node

/**
 * Script de verificación pre-build para Vercel
 * Verifica que todos los archivos necesarios estén presentes
 * y que no haya problemas obvios antes del deploy
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Ejecutando verificación pre-build...\n');

// Archivos críticos que deben existir
const criticalFiles = [
  'package.json',
  'next.config.js',
  'tsconfig.json',
  '.env.example',
  'public/manifest.json',
  'public/sw.js',
  'app/layout.tsx',
  'app/dashboard/page.tsx',
  'components/layout/sidebar.tsx'
];

// Verificar archivos críticos
let allFilesExist = true;
console.log('📁 Verificando archivos críticos:');

criticalFiles.forEach(file => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

// Verificar package.json
console.log('\n📦 Verificando package.json:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Verificar scripts necesarios
  const requiredScripts = ['build', 'start', 'dev'];
  requiredScripts.forEach(script => {
    const exists = packageJson.scripts && packageJson.scripts[script];
    console.log(`  ${exists ? '✅' : '❌'} Script "${script}"`);
    if (!exists) allFilesExist = false;
  });
  
  // Verificar dependencias críticas
  const criticalDeps = ['next', 'react', 'react-dom', '@supabase/supabase-js'];
  criticalDeps.forEach(dep => {
    const exists = packageJson.dependencies && packageJson.dependencies[dep];
    console.log(`  ${exists ? '✅' : '❌'} Dependencia "${dep}"`);
    if (!exists) allFilesExist = false;
  });
  
} catch (error) {
  console.log('  ❌ Error leyendo package.json:', error.message);
  allFilesExist = false;
}

// Verificar variables de entorno
console.log('\n🔐 Verificando configuración de entorno:');
const envExample = fs.existsSync('.env.example');
console.log(`  ${envExample ? '✅' : '❌'} .env.example existe`);

// Verificar estructura de directorios
console.log('\n📂 Verificando estructura de directorios:');
const requiredDirs = [
  'app',
  'components',
  'lib',
  'public',
  'scripts'
];

requiredDirs.forEach(dir => {
  const exists = fs.existsSync(dir);
  console.log(`  ${exists ? '✅' : '❌'} ${dir}/`);
  if (!exists) allFilesExist = false;
});

// Verificar archivos PWA
console.log('\n📱 Verificando archivos PWA:');
const pwaFiles = [
  'public/manifest.json',
  'public/sw.js',
  'public/browserconfig.xml'
];

pwaFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Resultado final
console.log('\n' + '='.repeat(50));
if (allFilesExist) {
  console.log('🎉 ¡Verificación completada! El proyecto está listo para deploy.');
  console.log('\n📋 Pasos siguientes:');
  console.log('  1. Configura las variables de entorno en Vercel');
  console.log('  2. Ejecuta: npm run build (para verificar localmente)');
  console.log('  3. Deploy a Vercel');
  process.exit(0);
} else {
  console.log('❌ Se encontraron problemas. Revisa los errores arriba.');
  console.log('\n🔧 Soluciones sugeridas:');
  console.log('  - Verifica que todos los archivos críticos existan');
  console.log('  - Instala las dependencias faltantes');
  console.log('  - Revisa la estructura de directorios');
  process.exit(1);
}
