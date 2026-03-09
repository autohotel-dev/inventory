// Script de prueba para impresora POS-80 (1) por USB
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

console.log('🖨️  Probando impresora POS-80 (1) por USB...\n');
console.log('📍 Puerto: USB002');
console.log('📍 Nombre: POS-80 (1)\n');

async function testPOS80USB() {
    try {
        const printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: '\\\\localhost\\POS-80 (1)',  // Nombre exacto de Windows
            characterSet: 'PC858_EURO',
            removeSpecialCharacters: false,
            lineCharacter: "=",
            width: 48,
            options: {
                timeout: 5000
            }
        });

        console.log('✓ Conexión establecida con POS-80 (1)\n');
        console.log('📝 Generando ticket de prueba...\n');

        // Header
        printer.alignCenter();
        printer.setTextDoubleHeight();
        printer.setTextDoubleWidth();
        printer.println("PRUEBA USB");
        printer.setTextNormal();
        printer.newLine();

        printer.drawLine();
        printer.alignLeft();

        // Información
        const ahora = new Date();
        printer.println(`Fecha: ${ahora.toLocaleDateString('es-MX')}`);
        printer.println(`Hora: ${ahora.toLocaleTimeString('es-MX')}`);
        printer.println(`Impresora: POS-80 (1)`);
        printer.println(`Puerto: USB002`);
        printer.drawLine();

        printer.newLine();
        printer.alignCenter();
        printer.bold(true);
        printer.println("CONEXION USB EXITOSA");
        printer.bold(false);
        printer.newLine();

        printer.println("La impresora esta funcionando");
        printer.println("correctamente por USB");
        printer.newLine();

        // Prueba de caracteres especiales en español
        printer.alignLeft();
        printer.drawLine();
        printer.println("Prueba de caracteres:");
        printer.println("Espanol: ñ, á, é, í, ó, ú");
        printer.println("Simbolos: $ € @ # %");
        printer.drawLine();

        printer.newLine();
        printer.newLine();
        printer.newLine();
        printer.cut();

        // Ejecutar impresión
        await printer.execute();

        console.log('✅ ¡IMPRESION EXITOSA!\n');
        console.log('═══════════════════════════════════════════');
        console.log('✓ La impresora POS-80 (1) está configurada');
        console.log('✓ La conexión USB funciona correctamente');
        console.log('✓ El ticket de prueba fue impreso');
        console.log('═══════════════════════════════════════════\n');
        console.log('🎉 ¡Listo! Ahora puedes usar el servicio de');
        console.log('   impresión térmica en tu aplicación.\n');

    } catch (error) {
        console.error('❌ ERROR al imprimir:\n');
        console.error(error.message);
        console.log('\n💡 Posibles soluciones:');
        console.log('1. Verifica que la impresora esté encendida');
        console.log('2. Intenta imprimir una página de prueba desde Windows');
        console.log('3. Verifica que el nombre sea exacto: "POS-80 (1)"');
        console.log('4. Asegúrate de tener los drivers instalados');
        console.log('5. Intenta reconectar el cable USB');
    }
}

testPOS80USB();
