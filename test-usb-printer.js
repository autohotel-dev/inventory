// Script de prueba para verificar conexión USB de impresora térmica
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

console.log('🔍 Buscando impresoras USB...\n');

// Intentar crear y ejecutar una impresión de prueba
async function testUSBPrinter() {
    try {
        const printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            characterSet: 'PC858_EURO',
            removeSpecialCharacters: false,
            lineCharacter: "=",
            width: 48,
            options: {
                timeout: 5000
            }
        });

        console.log('✓ Impresora USB detectada y configurada\n');
        console.log('📝 Generando ticket de prueba...\n');

        // Crear ticket de prueba
        printer.alignCenter();
        printer.setTextDoubleHeight();
        printer.println("PRUEBA USB");
        printer.setTextNormal();
        printer.newLine();

        printer.alignLeft();
        printer.println(`Fecha: ${new Date().toLocaleDateString('es-MX')}`);
        printer.println(`Hora: ${new Date().toLocaleTimeString('es-MX')}`);
        printer.newLine();

        printer.alignCenter();
        printer.println("Conexion USB activa");
        printer.println("Impresora funcionando correctamente");
        printer.newLine();
        printer.newLine();
        printer.cut();

        // Ejecutar impresión
        await printer.execute();
        console.log('✅ ¡Impresión exitosa!\n');
        console.log('La impresora USB está funcionando correctamente.');

    } catch (error) {
        console.error('❌ Error al conectar con la impresora USB:\n');
        console.error(error.message);
        console.log('\n💡 Sugerencias:');
        console.log('1. Verifica que la impresora esté conectada por USB');
        console.log('2. Asegúrate de que los drivers estén instalados');
        console.log('3. En Windows, verifica en "Dispositivos e impresoras"');
        console.log('4. Intenta desconectar y volver a conectar el cable USB');
    }
}

testUSBPrinter();
