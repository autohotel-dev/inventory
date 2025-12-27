// Script de prueba para verificar las nuevas leyendas de tickets
const { ThermalPrinterService } = require('./lib/services/thermal-printer-service');
const { PrinterTypes } = require('node-thermal-printer');

async function testUpdatedTickets() {
    console.log('🧪 Probando tickets con nuevas leyendas...\n');

    const printer = new ThermalPrinterService({
        type: 'usb',
        interface: '\\\\localhost\\POS-80 (1)',
        printerType: PrinterTypes.EPSON,
        characterSet: 'PC858_EURO',
        width: 48
    });

    const testData = {
        roomNumber: '101',
        folio: 'COM-251226-TEST1',
        date: new Date(),
        items: [
            { name: 'Refresco', qty: 2, price: 25, total: 50 },
            { name: 'Agua', qty: 1, price: 15, total: 15 },
            { name: 'Botana', qty: 3, price: 30, total: 90 }
        ],
        subtotal: 155,
        total: 155,
        hotelName: 'Hotel Ejemplo'
    };

    try {
        console.log('📝 Imprimiendo AMBOS tickets de prueba...\n');
        console.log('   ✓ Ticket 1: Comanda de Recepción');
        console.log('     - Leyenda: "Consumo pagado"');
        console.log('   ✓ Ticket 2: Ticket de Cliente');
        console.log('     - Título: "CONSUMO PAGADO"');
        console.log('     - Nota: "PAGADO"\n');

        await printer.printBothTickets(testData);

        console.log('✅ ¡Tickets impresos exitosamente!\n');
        console.log('═══════════════════════════════════════════');
        console.log('Revisa los tickets impresos:');
        console.log('1. Comanda de recepción debe decir "Consumo pagado"');
        console.log('2. Ticket de cliente debe decir "CONSUMO PAGADO"');
        console.log('3. Ya NO debe aparecer "Pendiente de pago"');
        console.log('═══════════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testUpdatedTickets();
