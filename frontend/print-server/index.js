const express = require('express');
const cors = require('cors');
const net = require('net');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de impresora de red
const PRINTER_IP = process.env.PRINTER_IP || '192.168.0.104';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100');
const PRINTER_TIMEOUT = 5000;

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const CMD = {
    INIT: `${ESC}@`,
    ALIGN_LEFT: `${ESC}a\x00`,
    ALIGN_CENTER: `${ESC}a\x01`,
    BOLD_ON: `${ESC}E\x01`,
    BOLD_OFF: `${ESC}E\x00`,
    DOUBLE_HEIGHT: `${GS}!\x10`,
    DOUBLE_SIZE: `${GS}!\x30`,
    NORMAL_SIZE: `${GS}!\x00`,
    NEW_LINE: '\n',
    CUT: `${GS}V\x00`,
    DIVIDER: '==========================================',
    DIVIDER_DASH: '------------------------------------------',
    DIVIDER_DOUBLE: '==========================================',
    MARGIN: '\n\n',
};

// Configurar CORS para permitir peticiones desde todos los orígenes necesarios
const allowedOrigins = [
    'http://localhost:3000',
    'https://manager.autohoteluxor.com'
];

// Middleware CORS manual para manejar preflight correctamente a través de Cloudflare Tunnel
app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Verificar si el origen está permitido
    const isAllowed = allowedOrigins.includes(origin) ||
        (origin && origin === 'https://inventory-luxor.vercel.app');

    if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Responder inmediatamente a preflight OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    next();
});

app.use(express.json({ limit: '10mb' }));

// Helpers
function formatMoney(amount) {
    return `$${amount.toFixed(2)}`;
}

function formatLine(left, right, width = 42) {
    const spaces = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
}

function formatDateTime(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return {
        dateStr: d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        timeStr: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    };
}

// Enviar a impresora por TCP
function sendToPrinter(data) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let resolved = false;

        socket.setTimeout(PRINTER_TIMEOUT);

        socket.on('connect', () => {
            console.log(`[PRINTER] Conectado a ${PRINTER_IP}:${PRINTER_PORT}`);
            socket.write(data, 'binary', (err) => {
                if (err) {
                    console.error('[PRINTER] Error al escribir:', err);
                    if (!resolved) {
                        resolved = true;
                        socket.destroy();
                        reject(err);
                    }
                } else {
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            socket.end();
                            resolve(true);
                        }
                    }, 500);
                }
            });
        });

        socket.on('error', (err) => {
            console.error('[PRINTER] Error de socket:', err);
            if (!resolved) {
                resolved = true;
                reject(new Error(`Error de conexión: ${err.message}`));
            }
        });

        socket.on('timeout', () => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                reject(new Error('Timeout: La impresora no responde'));
            }
        });

        socket.on('close', () => {
            console.log('[PRINTER] Conexión cerrada');
        });

        socket.connect(PRINTER_PORT, PRINTER_IP);
    });
}

// === BUILDERS DE TICKETS ===

function buildReceptionTicket(data) {
    const { dateStr, timeStr } = formatDateTime(data.date);

    let t = CMD.INIT;
    // Margen superior
    t += CMD.MARGIN;
    t += CMD.ALIGN_CENTER + CMD.DOUBLE_HEIGHT;
    t += 'COMANDA' + CMD.NEW_LINE;
    t += CMD.NORMAL_SIZE + CMD.BOLD_ON + 'RECEPCION' + CMD.BOLD_OFF + CMD.NEW_LINE;
    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;

    t += CMD.ALIGN_LEFT;
    t += `Fecha: ${dateStr} - ${timeStr}` + CMD.NEW_LINE;
    t += CMD.DOUBLE_HEIGHT + `Hab: ${data.roomNumber}` + CMD.NORMAL_SIZE + CMD.NEW_LINE;
    t += `Folio: ${data.folio}` + CMD.NEW_LINE;
    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;

    t += CMD.BOLD_ON + 'CONSUMOS:' + CMD.NEW_LINE + CMD.BOLD_OFF;

    // Imprimir items
    if (data.items && data.items.length > 0) {
        data.items.forEach(item => {
            const itemLine = `${item.qty}x ${item.name}`;
            const priceLine = formatMoney(item.total);
            t += formatLine(itemLine, priceLine) + CMD.NEW_LINE;
        });
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += CMD.BOLD_ON + formatLine('TOTAL:', formatMoney(data.total)) + CMD.BOLD_OFF + CMD.NEW_LINE;
    } else {
        t += '(Sin items)' + CMD.NEW_LINE;
    }

    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
    // Margen inferior
    t += CMD.MARGIN + CMD.NEW_LINE + CMD.CUT;

    return t;
}

function buildClientTicket(data) {
    const { dateStr, timeStr } = formatDateTime(data.date);

    let t = CMD.INIT;
    // Margen superior
    t += CMD.MARGIN;
    t += CMD.ALIGN_CENTER + CMD.DOUBLE_HEIGHT;
    t += 'TICKET CONSUMO' + CMD.NEW_LINE;
    t += CMD.NORMAL_SIZE;
    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;

    t += CMD.ALIGN_LEFT;
    t += `Fecha: ${dateStr} - ${timeStr}` + CMD.NEW_LINE;
    t += CMD.DOUBLE_HEIGHT + `Hab: ${data.roomNumber}` + CMD.NORMAL_SIZE + CMD.NEW_LINE;
    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;

    // Imprimir items
    if (data.items && data.items.length > 0) {
        data.items.forEach(item => {
            const itemLine = `${item.qty}x ${item.name}`;
            const priceLine = formatMoney(item.total);
            t += formatLine(itemLine, priceLine) + CMD.NEW_LINE;
        });
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += CMD.BOLD_ON + formatLine('TOTAL:', formatMoney(data.total)) + CMD.BOLD_OFF + CMD.NEW_LINE;
    }

    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
    t += CMD.ALIGN_CENTER;
    t += 'Gracias por su preferencia' + CMD.NEW_LINE;
    // Margen inferior
    t += CMD.MARGIN + CMD.NEW_LINE + CMD.CUT;

    return t;
}

function buildClosingTicket(data) {
    const { dateStr: startDate, timeStr: startTime } = formatDateTime(data.periodStart);
    const { dateStr: endDate, timeStr: endTime } = formatDateTime(data.periodEnd);

    let t = CMD.INIT;
    // Margen superior
    t += CMD.MARGIN;
    t += CMD.ALIGN_CENTER + CMD.DOUBLE_SIZE + 'CORTE DE CAJA' + CMD.NEW_LINE;
    t += CMD.NORMAL_SIZE + CMD.NEW_LINE;
    t += CMD.BOLD_ON + data.shiftName + CMD.NEW_LINE + CMD.BOLD_OFF;
    t += data.employeeName + CMD.NEW_LINE;
    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;

    t += CMD.ALIGN_LEFT;
    t += `Inicio: ${startDate} ${startTime}` + CMD.NEW_LINE;
    t += `Fin:    ${endDate} ${endTime}` + CMD.NEW_LINE;
    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;

    t += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'RESUMEN' + CMD.NEW_LINE + CMD.BOLD_OFF;
    t += CMD.ALIGN_LEFT;

    t += CMD.BOLD_ON + 'EFECTIVO' + CMD.NEW_LINE + CMD.BOLD_OFF;
    t += `  Esperado:   ${formatMoney(data.totalCash)}` + CMD.NEW_LINE;
    t += `  Contado:    ${formatMoney(data.countedCash)}` + CMD.NEW_LINE;
    const diff = data.cashDifference >= 0 ? '+' : '';
    t += `  Diferencia: ${diff}${formatMoney(data.cashDifference)}` + CMD.NEW_LINE + CMD.NEW_LINE;

    if (data.totalCardBBVA > 0) {
        t += CMD.BOLD_ON + 'TARJETA BBVA' + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += `  Total: ${formatMoney(data.totalCardBBVA)}` + CMD.NEW_LINE + CMD.NEW_LINE;
    }

    if (data.totalCardGetnet > 0) {
        t += CMD.BOLD_ON + 'TARJETA GETNET' + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += `  Total: ${formatMoney(data.totalCardGetnet)}` + CMD.NEW_LINE + CMD.NEW_LINE;
    }

    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
    t += CMD.BOLD_ON + formatLine('TOTAL VENTAS:', formatMoney(data.totalSales)) + CMD.NEW_LINE + CMD.BOLD_OFF;
    t += `Transacciones: ${data.totalTransactions}` + CMD.NEW_LINE;
    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;

    // Detalle de transacciones (si hay)
    if (data.transactions && data.transactions.length > 0) {
        t += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'DETALLE' + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += CMD.ALIGN_LEFT;

        const cashTx = data.transactions.filter(tx => tx.paymentMethod === 'EFECTIVO');
        const bbvaTx = data.transactions.filter(tx => tx.paymentMethod === 'TARJETA_BBVA' || (tx.paymentMethod === 'TARJETA' && tx.terminalCode === 'BBVA'));
        const getnetTx = data.transactions.filter(tx => tx.paymentMethod === 'TARJETA_GETNET' || (tx.paymentMethod === 'TARJETA' && tx.terminalCode === 'GETNET'));

        if (cashTx.length > 0) {
            t += CMD.BOLD_ON + `EFECTIVO (${cashTx.length})` + CMD.NEW_LINE + CMD.BOLD_OFF;
            cashTx.forEach((tx, i) => {
                t += `${i + 1}. ${tx.time}  ${formatMoney(tx.amount)}` + CMD.NEW_LINE;
                if (tx.items && tx.items.length > 0) {
                    tx.items.forEach(item => {
                        t += `   ${item.qty}x ${item.name}` + CMD.NEW_LINE;
                    });
                }
            });
            t += CMD.NEW_LINE;
        }

        if (bbvaTx.length > 0) {
            t += CMD.BOLD_ON + `BBVA (${bbvaTx.length})` + CMD.NEW_LINE + CMD.BOLD_OFF;
            bbvaTx.forEach((tx, i) => {
                t += `${i + 1}. ${tx.time}  ${formatMoney(tx.amount)}` + CMD.NEW_LINE;
            });
            t += CMD.NEW_LINE;
        }

        if (getnetTx.length > 0) {
            t += CMD.BOLD_ON + `GETNET (${getnetTx.length})` + CMD.NEW_LINE + CMD.BOLD_OFF;
            getnetTx.forEach((tx, i) => {
                t += `${i + 1}. ${tx.time}  ${formatMoney(tx.amount)}` + CMD.NEW_LINE;
            });
            t += CMD.NEW_LINE;
        }

        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
    }

    if (data.notes && data.notes.trim()) {
        t += CMD.BOLD_ON + 'NOTAS:' + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += data.notes.trim() + CMD.NEW_LINE;
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
    }

    t += CMD.ALIGN_CENTER;
    t += `Impreso: ${new Date().toLocaleString('es-MX')}` + CMD.NEW_LINE;
    // Margen inferior
    t += CMD.MARGIN + CMD.NEW_LINE + CMD.CUT;

    return t;
}

// === ENDPOINTS ===

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'thermal-print-server',
        version: '2.0.0',
        printerIP: PRINTER_IP,
        printerPort: PRINTER_PORT,
        timestamp: new Date().toISOString()
    });
});

// Endpoint unificado para impresión
app.post('/print', async (req, res) => {
    try {
        const { type, data } = req.body;

        console.log(`📄 Recibiendo trabajo de impresión: ${type}`);

        let ticket;
        switch (type) {
            case 'reception':
                ticket = buildReceptionTicket(data);
                break;
            case 'client':
                ticket = buildClientTicket(data);
                break;
            case 'closing':
                ticket = buildClosingTicket(data);
                break;
            default:
                return res.status(400).json({ error: 'Tipo de impresión inválido' });
        }

        await sendToPrinter(ticket);

        console.log(`✅ Ticket ${type} impreso correctamente`);
        res.json({ success: true, message: 'Ticket impreso correctamente' });

    } catch (error) {
        console.error('❌ Error de impresión:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint de prueba de impresión
app.post('/print/test', async (req, res) => {
    try {
        let t = CMD.INIT;
        t += CMD.ALIGN_CENTER + CMD.DOUBLE_SIZE;
        t += 'PRUEBA DE IMPRESION' + CMD.NEW_LINE;
        t += CMD.NORMAL_SIZE + CMD.NEW_LINE;
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += `Fecha: ${new Date().toLocaleDateString('es-MX')}` + CMD.NEW_LINE;
        t += `Hora: ${new Date().toLocaleTimeString('es-MX')}` + CMD.NEW_LINE;
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += 'Impresora OK' + CMD.NEW_LINE;
        t += `IP: ${PRINTER_IP}:${PRINTER_PORT}` + CMD.NEW_LINE;
        t += CMD.NEW_LINE + CMD.NEW_LINE + CMD.CUT;

        await sendToPrinter(t);

        console.log('✅ Prueba de impresión completada');
        res.json({ success: true, message: 'Prueba completada' });

    } catch (error) {
        console.error('❌ Error en prueba:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mantener endpoint legacy para cortes
app.post('/print-closing', async (req, res) => {
    try {
        const data = req.body;

        // Mapear datos del formato legacy al nuevo formato
        const closingData = {
            employeeName: data.employee_name,
            shiftName: data.shift_type,
            periodStart: data.clock_in_at,
            periodEnd: data.clock_out_at || new Date(),
            totalCash: data.total_cash || 0,
            totalCardBBVA: data.total_card_bbva || 0,
            totalCardGetnet: data.total_card_getnet || 0,
            totalSales: data.total_amount || 0,
            totalTransactions: data.total_transactions || 0,
            countedCash: data.counted_cash || data.total_cash || 0,
            cashDifference: (data.counted_cash || data.total_cash || 0) - (data.total_cash || 0),
            notes: data.notes || '',
            transactions: data.transactions || []
        };

        const ticket = buildClosingTicket(closingData);
        await sendToPrinter(ticket);

        console.log('✅ Corte de caja impreso');
        res.json({ success: true, message: 'Corte impreso correctamente' });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🖨️  ================================');
    console.log('   THERMAL PRINT SERVER v2.0');
    console.log('   ================================');
    console.log('');
    console.log(`   🌐 URL: http://localhost:${PORT}`);
    console.log(`   🖨️  Impresora: ${PRINTER_IP}:${PRINTER_PORT}`);
    console.log('');
    console.log('   📡 Orígenes permitidos:');
    console.log('      - http://localhost:3000');
    console.log('      - https://manager.autohoteluxor.com');
    console.log('');
    console.log('   Endpoints:');
    console.log('      GET  /health      - Estado del servidor');
    console.log('      POST /print       - Imprimir ticket');
    console.log('      POST /print/test  - Prueba de impresión');
    console.log('');
});
