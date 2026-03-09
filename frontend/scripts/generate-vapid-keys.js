/**
 * Script to generate VAPID keys for Web Push notifications
 * Run: node scripts/generate-vapid-keys.js
 */

const webpush = require('web-push');

console.log('\n🔐 Generando claves VAPID para notificaciones push...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('✅ Claves generadas exitosamente!\n');
console.log('======================================');
console.log('Agrega estas claves a tu archivo .env.local:');
console.log('======================================\n');

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:tu_email@hotel.com\n`);

console.log('======================================');
console.log('⚠️  IMPORTANTE:');
console.log('- La clave pública (PUBLIC_KEY) se usa en el cliente');
console.log('- La clave privada (PRIVATE_KEY) SOLO se usa en el servidor');
console.log('- NUNCA expongas la clave privada públicamente');
console.log('- Cambia "tu_email@hotel.com" por tu email real');
console.log('======================================\n');
