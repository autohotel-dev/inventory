// Helper para encontrar y listar impresoras disponibles en Windows
const { execSync } = require('child_process');

console.log('🔍 Buscando impresoras en Windows...\n');

try {
    // Listar todas las impresoras instaladas
    const output = execSync('wmic printer get name,portname', { encoding: 'utf-8' });

    console.log('📋 Impresoras encontradas:\n');
    console.log(output);

    console.log('\n' + '='.repeat(60));
    console.log('💡 INSTRUCCIONES:');
    console.log('='.repeat(60));
    console.log('\n1. Encuentra el nombre de tu impresora térmica en la lista de arriba');
    console.log('2. Copia el nombre EXACTO de la impresora');
    console.log('3. Usa una de estas configuraciones:\n');

    console.log('   OPCIÓN A - Nombre de impresora Windows:');
    console.log('   ----------------------------------------');
    console.log('   const printer = getPrinterInstance({');
    console.log('       type: \'usb\',');
    console.log('       interface: \'\\\\\\\\localhost\\\\NOMBRE_DE_TU_IMPRESORA\',');
    console.log('       printerType: PrinterTypes.EPSON,');
    console.log('       characterSet: \'PC858_EURO\',');
    console.log('       width: 48');
    console.log('   });\n');

    console.log('   OPCIÓN B - Puerto USB directo:');
    console.log('   -------------------------------');
    console.log('   const printer = getPrinterInstance({');
    console.log('       type: \'usb\',');
    console.log('       interface: \'PUERTO_USB\',  // Ej: USB001, USB002, etc');
    console.log('       printerType: PrinterTypes.EPSON,');
    console.log('       characterSet: \'PC858_EURO\',');
    console.log('       width: 48');
    console.log('   });\n');

    console.log('4. Reemplaza NOMBRE_DE_TU_IMPRESORA con el nombre exacto');
    console.log('5. Guarda y prueba con printer.printTest()');
    console.log('\n' + '='.repeat(60) + '\n');

} catch (error) {
    console.error('❌ Error al listar impresoras:', error.message);
    console.log('\n💡 Alternativa: Abre "Dispositivos e impresoras" manualmente');
    console.log('   Panel de Control > Dispositivos e impresoras');
}
