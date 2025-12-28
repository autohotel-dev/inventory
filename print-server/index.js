const express = require('express');
const cors = require('cors');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar CORS para permitir peticiones desde tu dominio
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'https://manager.autohoteluxor.com',
        /^https:\/\/.*\.vercel\.app$/  // Permitir dominios de Vercel para testing
    ],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Función helper para formatear moneda
function formatMoney(amount) {
    return `$${amount.toFixed(2)}`;
}

// Función helper para centrar texto
function centerText(text, width = 32) {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
}

// Endpoint de health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'thermal-print-server',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Endpoint para imprimir corte de caja
app.post('/print-closing', async (req, res) => {
    try {
        const data = req.body;

        console.log('📄 Recibiendo trabajo de impresión:', {
            employee: data.employee_name,
            shift: data.shift_type,
            total_cash: data.total_cash,
            total_card: data.total_card
        });

        // Buscar impresora USB
        const devices = escpos.USB.findPrinter();

        if (devices.length === 0) {
            console.error('❌ No se encontró ninguna impresora USB');
            return res.status(404).json({
                error: 'No se encontró ninguna impresora térmica conectada'
            });
        }

        // Usar la primera impresora encontrada
        const device = new escpos.USB(devices[0].deviceDescriptor.idVendor, devices[0].deviceDescriptor.idProduct);
        const printer = new escpos.Printer(device);

        // Abrir conexión con la impresora
        device.open(function (error) {
            if (error) {
                console.error('❌ Error al abrir impresora:', error);
                return res.status(500).json({
                    error: 'Error al conectar con la impresora',
                    details: error.message
                });
            }

            try {
                // Imprimir ticket
                printer
                    .font('a')
                    .align('ct')
                    .style('bu')
                    .size(1, 1)
                    .text('CORTE DE CAJA')
                    .text('AutoHotel Luxor')
                    .style('normal')
                    .text('================================')
                    .align('lt')
                    .text(`Empleado: ${data.employee_name}`)
                    .text(`Turno: ${data.shift_type}`)
                    .text(`Inicio: ${new Date(data.clock_in_at).toLocaleString('es-MX')}`)
                    .text(`Fin: ${data.clock_out_at ? new Date(data.clock_out_at).toLocaleString('es-MX') : 'En curso'}`)
                    .text('================================')
                    .text('')
                    .text('RESUMEN DE PAGOS')
                    .text('--------------------------------')
                    .text(`Efectivo:        ${formatMoney(data.total_cash).padStart(15)}`)
                    .text(`Tarjeta BBVA:    ${formatMoney(data.total_card_bbva).padStart(15)}`)
                    .text(`Tarjeta GETNET:  ${formatMoney(data.total_card_getnet).padStart(15)}`)
                    .text('--------------------------------')
                    .style('b')
                    .text(`TOTAL:           ${formatMoney(data.total_amount).padStart(15)}`)
                    .style('normal')
                    .text('================================')
                    .text('')
                    .text('DESGLOSE')
                    .text('--------------------------------')
                    .text(`Total Ventas:    ${formatMoney(data.total_sales).padStart(15)}`)
                    .text(`Total Cobrado:   ${formatMoney(data.total_collected).padStart(15)}`)
                    .text(`Pendiente:       ${formatMoney(data.total_pending).padStart(15)}`)
                    .text('================================')
                    .text('')
                    .text(`# Transacciones: ${data.total_transactions}`)
                    .text(`# Habitaciones:  ${data.total_rooms}`)
                    .text('')
                    .text('================================')
                    .align('ct')
                    .text('Gracias por su preferencia')
                    .text(`${new Date().toLocaleString('es-MX')}`)
                    .text('')
                    .text('')
                    .cut()
                    .close(() => {
                        console.log('✅ Ticket impreso correctamente');
                        res.json({
                            success: true,
                            message: 'Ticket impreso correctamente'
                        });
                    });

            } catch (printError) {
                console.error('❌ Error durante la impresión:', printError);
                device.close();
                res.status(500).json({
                    error: 'Error durante la impresión',
                    details: printError.message
                });
            }
        });

    } catch (error) {
        console.error('❌ Error general:', error);
        res.status(500).json({
            error: 'Error al procesar la solicitud de impresión',
            details: error.message
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🖨️  Servidor de impresión corriendo en http://localhost:${PORT}`);
    console.log(`📡 Aceptando peticiones desde:`);
    console.log(`   - http://localhost:3000 (desarrollo)`);
    console.log(`   - https://manager.autohoteluxor.com (producción)`);
    console.log('');
    console.log('Presiona Ctrl+C para detener el servidor');
});
