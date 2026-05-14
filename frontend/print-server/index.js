const express = require('express');
const cors = require('cors');
const net = require('net');
const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Dynamic Printer Config ──────────────────────────────────────────
// Persisted in a local JSON file so the IP survives restarts/power outages.
const CONFIG_FILE = path.join(__dirname, 'printer-config.json');

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (err) {
        console.error('[CONFIG] Error reading config file:', err.message);
    }
    // Defaults
    return { printerIP: '192.168.0.106', printerPort: 9100, hpPrinterIP: '192.168.0.108', hpPrinterPort: 9100 };
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        console.log(`[CONFIG] Saved: ${config.printerIP}:${config.printerPort}`);
    } catch (err) {
        console.error('[CONFIG] Error saving config file:', err.message);
    }
}

// Load initial config (env vars override saved config)
const savedConfig = loadConfig();
let PRINTER_IP = process.env.PRINTER_IP || savedConfig.printerIP;
let PRINTER_PORT = parseInt(process.env.PRINTER_PORT || String(savedConfig.printerPort));
let HP_PRINTER_IP = process.env.HP_PRINTER_IP || savedConfig.hpPrinterIP || '192.168.0.108';
let HP_PRINTER_PORT = parseInt(process.env.HP_PRINTER_PORT || String(savedConfig.hpPrinterPort || 9100));
const PRINTER_TIMEOUT = 5000;

// Save initial config (in case it's the first run)
saveConfig({ printerIP: PRINTER_IP, printerPort: PRINTER_PORT, hpPrinterIP: HP_PRINTER_IP, hpPrinterPort: HP_PRINTER_PORT });

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

    // Verificar si el origen está permitido (incluyendo *.vercel.app)
    const isAllowed = allowedOrigins.includes(origin) ||
        (origin && /^https:\/\/.*\.vercel\.app$/.test(origin));

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
            const writeData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'binary');
            socket.write(writeData, (err) => {
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

// Enviar a impresora HP por TCP (PCL)
function sendToHPPrinter(data) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let resolved = false;

        socket.setTimeout(PRINTER_TIMEOUT);

        socket.on('connect', () => {
            console.log(`[HP] Conectado a ${HP_PRINTER_IP}:${HP_PRINTER_PORT}`);
            const writeData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
            socket.write(writeData, (err) => {
                if (err) {
                    console.error('[HP] Error al escribir:', err);
                    if (!resolved) { resolved = true; socket.destroy(); reject(err); }
                } else {
                    setTimeout(() => {
                        if (!resolved) { resolved = true; socket.end(); resolve(true); }
                    }, 1000); // HP needs a bit more time than thermal
                }
            });
        });

        socket.on('error', (err) => {
            console.error('[HP] Error de socket:', err);
            if (!resolved) { resolved = true; reject(new Error(`Error HP: ${err.message}`)); }
        });

        socket.on('timeout', () => {
            if (!resolved) { resolved = true; socket.destroy(); reject(new Error('Timeout: HP no responde')); }
        });

        socket.on('close', () => {
            console.log('[HP] Conexión cerrada');
        });

        socket.connect(HP_PRINTER_PORT, HP_PRINTER_IP);
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
    t += CMD.BOLD_ON + `Hab:  ${data.roomNumber}` + CMD.BOLD_OFF + CMD.NEW_LINE;
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
    t += CMD.BOLD_ON + `Hab:  ${data.roomNumber}` + CMD.BOLD_OFF + CMD.NEW_LINE;
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

    // ═══ DESGLOSE POR TIPO DE HABITACIÓN ═══
    if (data.roomBreakdown && Object.keys(data.roomBreakdown).length > 0) {
        t += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'HABITACIONES POR TIPO' + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += CMD.ALIGN_LEFT;
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        let totalRooms = 0, totalRoomAmount = 0;
        Object.entries(data.roomBreakdown).forEach(([typeName, info]) => {
            const { count, total } = info;
            totalRooms += count;
            totalRoomAmount += total;
            const label = `  ${String(count).padStart(2)}  ${typeName}`;
            t += formatLine(label, formatMoney(total)) + CMD.NEW_LINE;
        });
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += CMD.BOLD_ON + formatLine(`  ${String(totalRooms).padStart(2)}  TOTAL HAB.`, formatMoney(totalRoomAmount)) + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
    }

    // ═══ DESGLOSE DE EXTRAS ═══
    if (data.extraBreakdown && Object.keys(data.extraBreakdown).length > 0) {
        t += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'EXTRAS' + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += CMD.ALIGN_LEFT;
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        let totalExtras = 0, totalExtraAmount = 0;
        Object.entries(data.extraBreakdown).forEach(([label, info]) => {
            const { count, total } = info;
            totalExtras += count;
            totalExtraAmount += total;
            const line = `  ${String(count).padStart(2)}  ${label}`;
            t += formatLine(line, formatMoney(total)) + CMD.NEW_LINE;
        });
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += CMD.BOLD_ON + formatLine(`  ${String(totalExtras).padStart(2)}  TOTAL EXTRAS`, formatMoney(totalExtraAmount)) + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
    }

    // ═══ DESGLOSE DE CONSUMOS ═══
    if (data.consumptionBreakdown && Object.keys(data.consumptionBreakdown).length > 0) {
        t += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'CONSUMOS' + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += CMD.ALIGN_LEFT;
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        let totalConsumptions = 0, totalConsumptionAmount = 0;
        Object.entries(data.consumptionBreakdown).forEach(([productName, info]) => {
            const { count, total } = info;
            totalConsumptions += count;
            totalConsumptionAmount += total;
            const name = productName.length > 28 ? productName.substring(0, 27) + '.' : productName;
            const line = `  ${String(count).padStart(2)}  ${name}`;
            t += formatLine(line, formatMoney(total)) + CMD.NEW_LINE;
        });
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += CMD.BOLD_ON + formatLine(`  ${String(totalConsumptions).padStart(2)}  TOTAL CONSUMOS`, formatMoney(totalConsumptionAmount)) + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
    }

    // Detalle de transacciones (si hay)
    if (data.transactions && data.transactions.length > 0) {
        t += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'DETALLE' + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += CMD.ALIGN_LEFT;

        const cashTx = data.transactions.filter(tx => tx.paymentMethod === 'EFECTIVO');
        const bbvaTx = data.transactions.filter(tx => tx.paymentMethod === 'TARJETA_BBVA' || (tx.paymentMethod === 'TARJETA' && tx.terminalCode === 'BBVA'));
        const getnetTx = data.transactions.filter(tx => tx.paymentMethod === 'TARJETA_GETNET' || (tx.paymentMethod === 'TARJETA' && tx.terminalCode === 'GETNET'));

        // Helper to format transaction line with concept + room
        const fmtTxLine = (tx, i) => {
            let line = `${i + 1}. ${tx.time}  ${formatMoney(tx.amount)}`;
            if (tx.concept && tx.roomNumber) {
                line += ` (${tx.concept} Hab ${tx.roomNumber})`;
            } else if (tx.concept) {
                line += ` (${tx.concept})`;
            } else if (tx.roomNumber) {
                line += ` (Hab ${tx.roomNumber})`;
            }
            return line;
        };

        if (cashTx.length > 0) {
            t += CMD.BOLD_ON + `EFECTIVO (${cashTx.length})` + CMD.NEW_LINE + CMD.BOLD_OFF;
            cashTx.forEach((tx, i) => {
                t += fmtTxLine(tx, i) + CMD.NEW_LINE;
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
                t += fmtTxLine(tx, i) + CMD.NEW_LINE;
            });
            t += CMD.NEW_LINE;
        }

        if (getnetTx.length > 0) {
            t += CMD.BOLD_ON + `GETNET (${getnetTx.length})` + CMD.NEW_LINE + CMD.BOLD_OFF;
            getnetTx.forEach((tx, i) => {
                t += fmtTxLine(tx, i) + CMD.NEW_LINE;
            });
            t += CMD.NEW_LINE;
        }

        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
    }

    // Gastos del turno (si hay)
    if (data.expenses && data.expenses.length > 0) {
        const EXPENSE_LABELS = {
            UBER: 'Uber/Transporte', MAINTENANCE: 'Mantenimiento', REPAIR: 'Reparacion',
            SUPPLIES: 'Insumos', PETTY_CASH: 'Caja Chica', OTHER: 'Otro Gasto',
        };
        t += CMD.ALIGN_CENTER + CMD.BOLD_ON + 'GASTOS DEL TURNO' + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += CMD.ALIGN_LEFT;
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        let totalGastos = 0;
        data.expenses.forEach((exp, i) => {
            const label = EXPENSE_LABELS[exp.type] || exp.type || 'Gasto';
            const desc = exp.description.length > 24 ? exp.description.substring(0, 23) + '.' : exp.description;
            t += `${i + 1}. ${exp.time}  -${formatMoney(exp.amount)}` + CMD.NEW_LINE;
            t += `   ${label}: ${desc}` + CMD.NEW_LINE;
            totalGastos += exp.amount;
        });
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += CMD.BOLD_ON + formatLine('TOTAL GASTOS:', `-${formatMoney(totalGastos)}`) + CMD.NEW_LINE;
        t += formatLine('EFECTIVO NETO:', formatMoney((data.totalCash || 0) - totalGastos)) + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
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

function buildEntryTicket(data) {
    const { dateStr, timeStr } = formatDateTime(data.date);
    const checkoutStr = data.expectedCheckout
        ? formatDateTime(data.expectedCheckout)
        : null;

    let t = CMD.INIT;
    // Margen superior
    t += CMD.MARGIN;
    t += CMD.ALIGN_CENTER + CMD.DOUBLE_SIZE;
    t += 'ENTRADA' + CMD.NEW_LINE;
    t += CMD.NORMAL_SIZE + CMD.BOLD_ON + 'REGISTRO DE ESTANCIA' + CMD.BOLD_OFF + CMD.NEW_LINE;
    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;

    t += CMD.ALIGN_LEFT;
    t += `Fecha: ${dateStr} - ${timeStr}` + CMD.NEW_LINE;
    t += CMD.BOLD_ON + `Hab:  ${data.roomNumber}` + CMD.BOLD_OFF + CMD.NEW_LINE;
    t += `Tipo: ${data.roomTypeName || 'N/A'}` + CMD.NEW_LINE;
    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;

    // Personas
    t += CMD.BOLD_ON + `Personas: ${data.people || 1}` + CMD.BOLD_OFF + CMD.NEW_LINE;

    // Vehículo
    if (data.vehiclePlate) {
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += CMD.BOLD_ON + 'VEHICULO:' + CMD.NEW_LINE + CMD.BOLD_OFF;
        t += `  Placa: ${data.vehiclePlate}` + CMD.NEW_LINE;
        if (data.vehicleBrand) t += `  Marca: ${data.vehicleBrand}` + CMD.NEW_LINE;
        if (data.vehicleModel) t += `  Modelo: ${data.vehicleModel}` + CMD.NEW_LINE;
    }

    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;

    // Desglose de precio
    t += CMD.BOLD_ON + 'COBRO:' + CMD.NEW_LINE + CMD.BOLD_OFF;
    t += formatLine('Habitacion:', formatMoney(data.basePrice || 0)) + CMD.NEW_LINE;
    if (data.extraPeopleCost && data.extraPeopleCost > 0) {
        t += formatLine(`Personas extra (${data.extraPeopleCount || 0}):`, formatMoney(data.extraPeopleCost)) + CMD.NEW_LINE;
    }
    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
    t += CMD.BOLD_ON + formatLine('TOTAL:', formatMoney(data.totalPrice || 0)) + CMD.BOLD_OFF + CMD.NEW_LINE;

    // Método de pago
    if (data.paymentMethod) {
        t += `Pago: ${data.paymentMethod}` + CMD.NEW_LINE;
    }

    // Checkout esperado
    if (checkoutStr) {
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += CMD.BOLD_ON + `Salida: ${checkoutStr.dateStr} ${checkoutStr.timeStr}` + CMD.BOLD_OFF + CMD.NEW_LINE;
    }

    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
    // Margen inferior
    t += CMD.MARGIN + CMD.NEW_LINE + CMD.CUT;

    return t;
}

function buildPaymentTicket(data) {
    const { dateStr, timeStr } = formatDateTime(data.date || new Date());

    let t = CMD.INIT;
    // Margen superior
    t += CMD.MARGIN;
    t += CMD.ALIGN_CENTER + CMD.DOUBLE_HEIGHT;
    t += 'COMPROBANTE DE PAGO' + CMD.NEW_LINE;
    t += CMD.NORMAL_SIZE;
    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;

    t += CMD.ALIGN_LEFT;
    t += `Fecha: ${dateStr} - ${timeStr}` + CMD.NEW_LINE;
    if (data.roomNumber) {
        t += CMD.BOLD_ON + `Hab:  ${data.roomNumber}` + CMD.BOLD_OFF + CMD.NEW_LINE;
    }
    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;

    // Items/conceptos cobrados
    if (data.items && data.items.length > 0) {
        t += CMD.BOLD_ON + 'CONCEPTOS:' + CMD.NEW_LINE + CMD.BOLD_OFF;
        data.items.forEach(item => {
            const itemLine = `${item.qty || 1}x ${item.name}`;
            const priceLine = formatMoney(item.total || 0);
            t += formatLine(itemLine, priceLine) + CMD.NEW_LINE;
        });
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
    }

    // Total
    t += CMD.BOLD_ON + formatLine('TOTAL COBRADO:', formatMoney(data.total || 0)) + CMD.BOLD_OFF + CMD.NEW_LINE;

    // Método de pago
    if (data.paymentMethod) {
        t += `Metodo: ${data.paymentMethod}` + CMD.NEW_LINE;
    }

    // Saldo restante
    if (data.remainingAmount !== undefined && data.remainingAmount !== null) {
        t += formatLine('Saldo restante:', formatMoney(data.remainingAmount)) + CMD.NEW_LINE;
    }

    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
    t += CMD.ALIGN_CENTER;
    t += 'Gracias por su preferencia' + CMD.NEW_LINE;
    // Margen inferior
    t += CMD.MARGIN + CMD.NEW_LINE + CMD.CUT;

    return t;
}

function buildCheckoutTicket(data) {
    const { dateStr, timeStr } = formatDateTime(data.date || new Date());

    let t = CMD.INIT;
    // Margen superior
    t += CMD.MARGIN;
    t += CMD.ALIGN_CENTER + CMD.DOUBLE_SIZE;
    t += 'SALIDA' + CMD.NEW_LINE;
    t += CMD.NORMAL_SIZE + CMD.BOLD_ON + 'CHECKOUT' + CMD.BOLD_OFF + CMD.NEW_LINE;
    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;

    t += CMD.ALIGN_LEFT;
    t += `Fecha: ${dateStr} - ${timeStr}` + CMD.NEW_LINE;
    t += CMD.BOLD_ON + `Hab:  ${data.roomNumber}` + CMD.BOLD_OFF + CMD.NEW_LINE;
    if (data.folio) t += `Folio: ${data.folio}` + CMD.NEW_LINE;
    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;

    // Conceptos cobrados en la salida
    if (data.items && data.items.length > 0) {
        t += CMD.BOLD_ON + 'CONCEPTOS COBRADOS:' + CMD.NEW_LINE + CMD.BOLD_OFF;
        data.items.forEach(item => {
            const itemLine = `${item.qty}x ${item.name}`;
            const priceLine = formatMoney(item.total);
            t += formatLine(itemLine, priceLine) + CMD.NEW_LINE;
        });
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
    }

    // Total
    t += CMD.BOLD_ON + formatLine('TOTAL COBRADO:', formatMoney(data.total || 0)) + CMD.BOLD_OFF + CMD.NEW_LINE;

    // Cocheros
    if (data.entranceValet || data.exitValet) {
        t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
        t += CMD.BOLD_ON + 'VALETS:' + CMD.NEW_LINE + CMD.BOLD_OFF;
        if (data.entranceValet) t += `  Entrada: ${data.entranceValet}` + CMD.NEW_LINE;
        if (data.exitValet) t += `  Salida:  ${data.exitValet}` + CMD.NEW_LINE;
    }

    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
    t += CMD.ALIGN_CENTER;
    t += CMD.BOLD_ON + 'Habitacion liberada' + CMD.BOLD_OFF + CMD.NEW_LINE;
    // Margen inferior
    t += CMD.MARGIN + CMD.NEW_LINE + CMD.CUT;

    return t;
}

function buildToleranceTicket(data) {
    // data: { roomNumber, exitTime, returnDeadline, people, toleranceType }
    const exitDate = new Date(data.exitTime || new Date());
    const deadlineDate = new Date(data.returnDeadline || new Date(Date.now() + 3600000));
    const { dateStr, timeStr: exitTimeStr } = formatDateTime(exitDate);
    const { timeStr: deadlineTimeStr } = formatDateTime(deadlineDate);
    const toleranceType = data.toleranceType || 'PERSON_LEFT';

    let t = CMD.INIT;
    t += CMD.MARGIN;
    t += CMD.ALIGN_CENTER + CMD.DOUBLE_SIZE;
    t += 'SALIDA TEMPORAL' + CMD.NEW_LINE;
    t += CMD.NORMAL_SIZE + CMD.BOLD_ON;
    t += (toleranceType === 'ROOM_EMPTY' ? 'HABITACION VACIA' : 'PERSONA SALE') + CMD.NEW_LINE;
    t += CMD.BOLD_OFF;
    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;

    t += CMD.ALIGN_LEFT;
    t += `Fecha: ${dateStr}` + CMD.NEW_LINE;
    t += CMD.BOLD_ON + `Hab:  ${data.roomNumber}` + CMD.BOLD_OFF + CMD.NEW_LINE;
    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;

    t += CMD.BOLD_ON + 'HORA DE SALIDA:' + CMD.BOLD_OFF + CMD.NEW_LINE;
    t += CMD.ALIGN_CENTER + CMD.DOUBLE_SIZE;
    t += exitTimeStr + CMD.NEW_LINE;
    t += CMD.NORMAL_SIZE;
    t += CMD.ALIGN_LEFT + CMD.NEW_LINE;

    t += CMD.BOLD_ON + 'DEBE REGRESAR ANTES DE:' + CMD.BOLD_OFF + CMD.NEW_LINE;
    t += CMD.ALIGN_CENTER + CMD.DOUBLE_SIZE;
    t += deadlineTimeStr + CMD.NEW_LINE;
    t += CMD.NORMAL_SIZE;
    t += CMD.ALIGN_LEFT + CMD.NEW_LINE;

    t += CMD.DIVIDER_DASH + CMD.NEW_LINE;
    t += `Personas en hab: ${data.people ?? 0}` + CMD.NEW_LINE;
    t += `Tolerancia: 1 HORA` + CMD.NEW_LINE;
    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;

    t += CMD.ALIGN_CENTER;
    t += CMD.BOLD_ON + 'SI NO REGRESA A TIEMPO' + CMD.NEW_LINE;
    if (toleranceType === 'ROOM_EMPTY') {
        t += 'SE COBRARA HABITACION' + CMD.NEW_LINE;
        t += 'COMPLETA ADICIONAL' + CMD.NEW_LINE;
    } else {
        t += 'SE COBRARA PERSONA' + CMD.NEW_LINE;
        t += 'EXTRA ADICIONAL' + CMD.NEW_LINE;
    }
    t += CMD.BOLD_OFF;

    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
    t += CMD.MARGIN + CMD.NEW_LINE + CMD.CUT;

    return t;
}

function buildQRTicket(data) {
    // data: { roomNumber, url, title? }
    const url = data.url || '';
    const roomNumber = data.roomNumber || '';
    const title = data.title || 'PORTAL DE HUESPEDES';

    let t = CMD.INIT;
    // Margen superior
    t += CMD.MARGIN;

    // Header
    t += CMD.ALIGN_CENTER;
    t += CMD.BOLD_ON + CMD.DOUBLE_HEIGHT;
    t += title + CMD.NEW_LINE;
    t += CMD.NORMAL_SIZE;
    t += CMD.BOLD_ON;
    t += `Habitacion ${roomNumber}` + CMD.NEW_LINE;
    t += CMD.BOLD_OFF;
    t += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;
    t += CMD.NEW_LINE;

    // QR Code nativo ESC/POS usando GS ( k
    // Función 165: Modelo QR = Modelo 2
    const model = Buffer.from([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
    // Función 167: Tamaño del módulo (8 = grande para 80mm)
    const size = Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x08]);
    // Función 169: Error correction level = L (48=L, 49=M, 50=Q, 51=H)
    const errorCorr = Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]);
    // Función 180: Almacenar datos
    const urlBytes = Buffer.from(url, 'utf-8');
    const storeLen = urlBytes.length + 3;
    const pL = storeLen & 0xFF;
    const pH = (storeLen >> 8) & 0xFF;
    const storeData = Buffer.concat([
        Buffer.from([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]),
        urlBytes
    ]);
    // Función 181: Imprimir QR
    const printQR = Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]);

    // Convertir texto previo a buffer
    const textBefore = Buffer.from(t, 'binary');

    // Texto posterior
    let after = '';
    after += CMD.NEW_LINE;
    after += CMD.BOLD_ON;
    after += 'ESCANEA PARA ACCEDER' + CMD.NEW_LINE;
    after += 'A TU HABITACION' + CMD.NEW_LINE;
    after += CMD.BOLD_OFF;
    after += CMD.DIVIDER_DOUBLE + CMD.NEW_LINE;

    // Margen inferior
    after += CMD.MARGIN + CMD.NEW_LINE + CMD.CUT;

    const textAfter = Buffer.from(after, 'binary');

    // Concatenar todo como Buffer
    return Buffer.concat([textBefore, model, size, errorCorr, storeData, printQR, textAfter]);
}

// === ENDPOINTS ===

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'thermal-print-server',
        version: '2.2.0',
        printerIP: PRINTER_IP,
        printerPort: PRINTER_PORT,
        timestamp: new Date().toISOString()
    });
});

// ─── Config Endpoints (dynamic IP management) ───────────────────────

// GET /config — Returns current printer configuration
app.get('/config', (req, res) => {
    res.json({
        printerIP: PRINTER_IP,
        printerPort: PRINTER_PORT,
        hpPrinterIP: HP_PRINTER_IP,
        hpPrinterPort: HP_PRINTER_PORT,
        configFile: CONFIG_FILE,
    });
});

// POST /config — Update printer IP/port at runtime (persisted to disk)
app.post('/config', (req, res) => {
    const { printerIP, printerPort, hpPrinterIP, hpPrinterPort } = req.body;

    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

    if (printerIP && typeof printerIP === 'string') {
        if (!ipRegex.test(printerIP)) {
            return res.status(400).json({ error: 'Formato de IP inválido para impresora de tickets' });
        }
        PRINTER_IP = printerIP;
        console.log(`[CONFIG] Ticket printer IP updated to: ${PRINTER_IP}`);
    }

    if (printerPort && !isNaN(parseInt(printerPort))) {
        PRINTER_PORT = parseInt(printerPort);
    }

    if (hpPrinterIP && typeof hpPrinterIP === 'string') {
        if (!ipRegex.test(hpPrinterIP)) {
            return res.status(400).json({ error: 'Formato de IP inválido para impresora HP' });
        }
        HP_PRINTER_IP = hpPrinterIP;
        console.log(`[CONFIG] HP printer IP updated to: ${HP_PRINTER_IP}`);
    }

    if (hpPrinterPort && !isNaN(parseInt(hpPrinterPort))) {
        HP_PRINTER_PORT = parseInt(hpPrinterPort);
    }

    // Persist to disk
    saveConfig({ printerIP: PRINTER_IP, printerPort: PRINTER_PORT, hpPrinterIP: HP_PRINTER_IP, hpPrinterPort: HP_PRINTER_PORT });

    res.json({
        success: true,
        message: `Config actualizada — Tickets: ${PRINTER_IP}:${PRINTER_PORT}, HP: ${HP_PRINTER_IP}:${HP_PRINTER_PORT}`,
        printerIP: PRINTER_IP,
        printerPort: PRINTER_PORT,
        hpPrinterIP: HP_PRINTER_IP,
        hpPrinterPort: HP_PRINTER_PORT,
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
            case 'entry':
                ticket = buildEntryTicket(data);
                break;
            case 'payment':
                ticket = buildPaymentTicket(data);
                break;
            case 'checkout':
                ticket = buildCheckoutTicket(data);
                break;
            case 'qr':
                ticket = buildQRTicket(data);
                break;
            case 'tolerance':
                ticket = buildToleranceTicket(data);
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

// Endpoint de prueba de impresión (Thermal)
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

// ═══════════════════════════════════════════════════════════════════════
// HP PRINTER — PCL-based printing for letter-size reports
// ═══════════════════════════════════════════════════════════════════════

function formatLinePCL(left, right, width = 80) {
    const spaces = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
}

function buildHPClosingReport(data) {
    const { dateStr: startDate, timeStr: startTime } = formatDateTime(data.periodStart);
    const { dateStr: endDate, timeStr: endTime } = formatDateTime(data.periodEnd);

    const LINE = '='.repeat(72);
    const DASH = '-'.repeat(72);
    const NL = '\r\n';

    // PCL reset + set font (Courier 10pt for monospaced alignment)
    let doc = '\x1B%-12345X'; // UEL (Universal Exit Language)
    doc += '\x1BE';           // PCL Reset
    doc += '\x1B&l0O';        // Portrait
    doc += '\x1B&l2A';        // Letter size
    doc += '\x1B&l6D';        // 6 lines per inch
    doc += '\x1B&l4E';        // Top margin 4 lines
    doc += '\x1B(s0P';        // Fixed pitch
    doc += '\x1B(s12H';       // 12 characters per inch
    doc += '\x1B(s0S';        // Upright style
    doc += '\x1B(s3T';        // Courier font

    // ═══ HEADER ═══
    doc += NL;
    doc += '                         CORTE DE CAJA' + NL;
    doc += '                       Auto Hotel Luxor' + NL;
    doc += LINE + NL;
    doc += NL;
    doc += `  Empleado:   ${data.employeeName}` + NL;
    doc += `  Turno:      ${data.shiftName}` + NL;
    doc += `  Periodo:    ${startDate} ${startTime}  -->  ${endDate} ${endTime}` + NL;
    doc += LINE + NL;

    // ═══ RESUMEN DE VENTAS ═══
    doc += NL;
    doc += '  RESUMEN DE VENTAS' + NL;
    doc += DASH + NL;
    doc += formatLinePCL('    Efectivo:', formatMoney(data.totalCash), 72) + NL;
    doc += formatLinePCL('    Tarjeta BBVA:', formatMoney(data.totalCardBBVA), 72) + NL;
    doc += formatLinePCL('    Tarjeta GETNET:', formatMoney(data.totalCardGetnet), 72) + NL;
    doc += DASH + NL;
    doc += formatLinePCL('    TOTAL VENTAS:', formatMoney(data.totalSales), 72) + NL;
    doc += formatLinePCL('    Transacciones:', String(data.totalTransactions), 72) + NL;
    doc += NL;

    // ═══ EFECTIVO ═══
    doc += '  EFECTIVO' + NL;
    doc += DASH + NL;
    doc += formatLinePCL('    Efectivo cobrado:', formatMoney(data.totalCash), 72) + NL;
    if (data.totalExpenses && data.totalExpenses > 0) {
        doc += formatLinePCL('    (-) Gastos:', '-' + formatMoney(data.totalExpenses), 72) + NL;
    }
    const netCash = data.totalCash - (data.totalExpenses || 0);
    doc += DASH + NL;
    doc += formatLinePCL('    EFECTIVO NETO A ENTREGAR:', formatMoney(netCash), 72) + NL;
    doc += NL;

    // ═══ DETALLE DE GASTOS ═══
    if (data.expenses && data.expenses.length > 0) {
        doc += '  DETALLE DE GASTOS' + NL;
        doc += DASH + NL;
        doc += formatLinePCL('    Hora    Descripcion', 'Monto', 72) + NL;
        doc += DASH + NL;
        data.expenses.forEach(exp => {
            const time = formatDateTime(exp.created_at || exp.createdAt).timeStr;
            const desc = (exp.description || '').substring(0, 40);
            doc += formatLinePCL(`    ${time}   ${desc}`, '-' + formatMoney(Number(exp.amount)), 72) + NL;
        });
        doc += NL;
    }

    // ═══ DETALLE DE TRANSACCIONES ═══
    if (data.transactions && data.transactions.length > 0) {
        doc += '  DETALLE DE TRANSACCIONES' + NL;
        doc += DASH + NL;

        const cashTx = data.transactions.filter(tx => tx.paymentMethod === 'EFECTIVO');
        const bbvaTx = data.transactions.filter(tx => tx.paymentMethod === 'TARJETA_BBVA' || (tx.paymentMethod === 'TARJETA' && tx.terminalCode === 'BBVA'));
        const getnetTx = data.transactions.filter(tx => tx.paymentMethod === 'TARJETA_GETNET' || (tx.paymentMethod === 'TARJETA' && tx.terminalCode === 'GETNET'));

        if (cashTx.length > 0) {
            doc += NL + `    EFECTIVO (${cashTx.length} pagos)` + NL;
            doc += '    ' + '-'.repeat(64) + NL;
            cashTx.forEach((tx, i) => {
                doc += formatLinePCL(`    ${i + 1}. ${tx.time}  ${tx.concept || ''}`, formatMoney(tx.amount), 72) + NL;
                if (tx.items && tx.items.length > 0) {
                    tx.items.forEach(item => {
                        doc += `       ${item.qty}x ${item.name}` + NL;
                    });
                }
            });
        }

        if (bbvaTx.length > 0) {
            doc += NL + `    TARJETA BBVA (${bbvaTx.length} pagos)` + NL;
            doc += '    ' + '-'.repeat(64) + NL;
            bbvaTx.forEach((tx, i) => {
                doc += formatLinePCL(`    ${i + 1}. ${tx.time}  ${tx.concept || ''}`, formatMoney(tx.amount), 72) + NL;
            });
        }

        if (getnetTx.length > 0) {
            doc += NL + `    TARJETA GETNET (${getnetTx.length} pagos)` + NL;
            doc += '    ' + '-'.repeat(64) + NL;
            getnetTx.forEach((tx, i) => {
                doc += formatLinePCL(`    ${i + 1}. ${tx.time}  ${tx.concept || ''}`, formatMoney(tx.amount), 72) + NL;
            });
        }
        doc += NL;
    }

    // ═══ NOTAS ═══
    if (data.notes && data.notes.trim()) {
        doc += '  OBSERVACIONES' + NL;
        doc += DASH + NL;
        doc += `    ${data.notes.trim()}` + NL;
        doc += NL;
    }

    // ═══ FIRMAS ═══
    doc += NL + NL + NL;
    doc += LINE + NL;
    doc += NL;
    doc += '    _____________________________          _____________________________' + NL;
    doc += `    Entrega: ${(data.employeeName || '').substring(0, 20).padEnd(20)}          Recibe:` + NL;
    doc += NL;
    doc += LINE + NL;

    // ═══ PIE ═══
    doc += NL;
    doc += `    Impreso: ${new Date().toLocaleString('es-MX')}` + NL;
    doc += NL;

    // Form feed (eject page) + PCL Reset
    doc += '\x0C';    // Form feed
    doc += '\x1BE';   // PCL Reset
    doc += '\x1B%-12345X'; // UEL

    return doc;
}

// ─── HP Income Report Builder (PDF via pdfmake for proper table formatting) ──────
function buildHPIncomeReportPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            // Try Roboto from pdfmake, fallback to Helvetica (built-in PDF font)
            const robotoPath = path.join(__dirname, 'node_modules', 'pdfmake', 'standard-fonts', 'Roboto-Regular.ttf');
            let fontsToUse, fontName;

            if (fs.existsSync(robotoPath)) {
                fontsToUse = {
                    Roboto: {
                        normal: robotoPath,
                        bold: path.join(__dirname, 'node_modules', 'pdfmake', 'standard-fonts', 'Roboto-Medium.ttf'),
                        italics: path.join(__dirname, 'node_modules', 'pdfmake', 'standard-fonts', 'Roboto-Italic.ttf'),
                        bolditalics: path.join(__dirname, 'node_modules', 'pdfmake', 'standard-fonts', 'Roboto-MediumItalic.ttf'),
                    }
                };
                fontName = 'Roboto';
            } else {
                fontsToUse = {
                    Helvetica: {
                        normal: 'Helvetica',
                        bold: 'Helvetica-Bold',
                        italics: 'Helvetica-Oblique',
                        bolditalics: 'Helvetica-BoldOblique',
                    }
                };
                fontName = 'Helvetica';
            }

            const printer = new PdfPrinter(fontsToUse);
            const entries = data.entries || [];
            const { dateStr: startDate, timeStr: startTime } = formatDateTime(data.periodStart);
            const { dateStr: endDate, timeStr: endTime } = formatDateTime(data.periodEnd);

            // Calculate totals
            let sumPrice = 0, sumExtra = 0, sumConsumption = 0, sumTotal = 0;
            entries.forEach(e => {
                sumPrice += Number(e.room_price) || 0;
                sumExtra += Number(e.extra) || 0;
                sumConsumption += Number(e.consumption) || 0;
                sumTotal += Number(e.total) || 0;
            });

            // Build table header
            const tableHeader = [
                { text: 'No.', style: 'tableHeader', alignment: 'center' },
                { text: 'Horario', style: 'tableHeader', alignment: 'center' },
                { text: 'Placas', style: 'tableHeader', alignment: 'center' },
                { text: 'Hab.', style: 'tableHeader', alignment: 'center' },
                { text: 'Aprobó', style: 'tableHeader', alignment: 'center' },
                { text: 'Precio', style: 'tableHeader', alignment: 'right' },
                { text: 'Extra', style: 'tableHeader', alignment: 'right' },
                { text: 'Consumo', style: 'tableHeader', alignment: 'right' },
                { text: 'Total', style: 'tableHeader', alignment: 'right' },
                { text: 'Forma Pago', style: 'tableHeader', alignment: 'center' },
            ];

            const tableBody = [tableHeader];

            // Data rows
            entries.forEach((e, idx) => {
                const fillColor = idx % 2 === 0 ? null : '#f3f4f6';
                tableBody.push([
                    { text: String(idx + 1), alignment: 'center', fillColor, bold: true },
                    { text: e.time || '', alignment: 'center', fillColor },
                    { text: (e.vehicle_plate || '—').toUpperCase(), alignment: 'center', fillColor, fontSize: 8 },
                    { text: e.room_number || '', alignment: 'center', fillColor, bold: true },
                    { text: e.checkout_valet_name || '—', alignment: 'center', fillColor, fontSize: 8, color: '#555' },
                    { text: (e.room_price || 0) > 0 ? formatMoney(e.room_price) : '—', alignment: 'right', fillColor },
                    { text: (e.extra || 0) > 0 ? formatMoney(e.extra) : '—', alignment: 'right', fillColor },
                    { text: (e.consumption || 0) > 0 ? formatMoney(e.consumption) : '—', alignment: 'right', fillColor },
                    { text: formatMoney(e.total || 0), alignment: 'right', fillColor, bold: true },
                    { text: e.payment_method || '—', alignment: 'center', fillColor, fontSize: 8, bold: true },
                ]);
            });

            // Totals row
            tableBody.push([
                { text: 'SUMA TOTAL', colSpan: 5, alignment: 'right', bold: true, fillColor: '#e5e7eb', fontSize: 9 },
                {}, {}, {}, {},
                { text: formatMoney(sumPrice), alignment: 'right', bold: true, fillColor: '#e5e7eb' },
                { text: formatMoney(sumExtra), alignment: 'right', bold: true, fillColor: '#e5e7eb' },
                { text: formatMoney(sumConsumption), alignment: 'right', bold: true, fillColor: '#e5e7eb' },
                { text: formatMoney(sumTotal), alignment: 'right', bold: true, fillColor: '#e5e7eb', fontSize: 11 },
                { text: '', fillColor: '#e5e7eb' },
            ]);

            // Payment breakdown
            const breakdownBody = [
                [{ text: 'Método', bold: true, fontSize: 9 }, { text: 'Monto', bold: true, alignment: 'right', fontSize: 9 }],
            ];
            let totalPayments = 0;
            if (data.paymentBreakdown) {
                Object.entries(data.paymentBreakdown).forEach(([method, amount]) => {
                    breakdownBody.push([
                        { text: method, fontSize: 9 },
                        { text: formatMoney(Number(amount)), alignment: 'right', fontSize: 9 },
                    ]);
                    totalPayments += Number(amount);
                });
                breakdownBody.push([
                    { text: 'TOTAL', bold: true, fontSize: 10 },
                    { text: formatMoney(totalPayments), alignment: 'right', bold: true, fontSize: 11 },
                ]);
            }

            // Build PDF document definition
            const docDefinition = {
                pageSize: 'LETTER',
                pageOrientation: 'portrait',
                pageMargins: [30, 30, 30, 30],
                defaultStyle: { font: fontName, fontSize: 9 },
                content: [
                    {
                        columns: [
                            { text: 'Fecha: ' + new Date().toLocaleDateString('es-MX'), fontSize: 8, color: '#666' },
                            { text: 'N° 0001', fontSize: 8, alignment: 'right', bold: true, color: '#666' },
                        ],
                        marginBottom: 6,
                    },
                    { text: 'LUXOR AUTO HOTEL', fontSize: 16, bold: true, alignment: 'center' },
                    { text: 'INGRESOS DE HOSPEDAJE Y CONSUMO PÚBLICO EN GENERAL', fontSize: 11, bold: true, alignment: 'center', color: '#333', marginBottom: 6 },
                    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 2 }], marginBottom: 6 },
                    { text: 'Turno: ' + startDate + ' ' + startTime + '  —  ' + endDate + ' ' + endTime, alignment: 'center', fontSize: 8, color: '#666', marginBottom: 4 },
                    {
                        columns: [
                            { text: 'Recepcionista: ' + (data.employeeName || 'N/A'), fontSize: 8, color: '#444' },
                            { text: 'Registros: ' + entries.length, fontSize: 8, alignment: 'right', color: '#444' },
                        ],
                        marginBottom: 10,
                    },
                    {
                        table: {
                            headerRows: 1,
                            widths: [22, 38, 55, 28, 55, 50, 42, 50, 55, '*'],
                            body: tableBody,
                        },
                        layout: {
                            hLineWidth: function(i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5; },
                            vLineWidth: function() { return 0.5; },
                            hLineColor: function(i, node) { return (i === 0 || i === 1 || i === node.table.body.length) ? '#111' : '#d1d5db'; },
                            vLineColor: function() { return '#d1d5db'; },
                            paddingLeft: function() { return 4; },
                            paddingRight: function() { return 4; },
                            paddingTop: function() { return 3; },
                            paddingBottom: function() { return 3; },
                        },
                    },
                ],
                styles: {
                    tableHeader: { fontSize: 8, bold: true, color: '#ffffff', fillColor: '#1a1a2e' },
                },
            };

            // Add payment breakdown and summary if available
            if (data.paymentBreakdown && Object.keys(data.paymentBreakdown).length > 0) {
                docDefinition.content.push(
                    { text: '', marginTop: 14 },
                    {
                        columns: [
                            {
                                width: '50%',
                                stack: [
                                    { text: 'DESGLOSE POR MÉTODO DE PAGO', fontSize: 8, bold: true, color: '#555', marginBottom: 4 },
                                    {
                                        table: { widths: ['*', 'auto'], body: breakdownBody },
                                        layout: {
                                            hLineWidth: function(i, node) { return (i === 0 || i === node.table.body.length) ? 1.5 : 0.5; },
                                            vLineWidth: function() { return 0; },
                                            hLineColor: function(i, node) { return (i === 0 || i === node.table.body.length) ? '#111' : '#e5e7eb'; },
                                        },
                                    },
                                ],
                            },
                            {
                                width: '50%',
                                stack: [
                                    { text: 'RESUMEN', fontSize: 8, bold: true, color: '#555', marginBottom: 4 },
                                    {
                                        table: {
                                            widths: ['*', 'auto'],
                                            body: [
                                                [{ text: 'Recepcionista', fontSize: 9 }, { text: data.employeeName || 'N/A', alignment: 'right', bold: true, fontSize: 9 }],
                                                [{ text: 'Habitaciones', fontSize: 9 }, { text: formatMoney(sumPrice), alignment: 'right', fontSize: 9 }],
                                                [{ text: 'Extras', fontSize: 9 }, { text: formatMoney(sumExtra), alignment: 'right', fontSize: 9 }],
                                                [{ text: 'Consumo', fontSize: 9 }, { text: formatMoney(sumConsumption), alignment: 'right', fontSize: 9 }],
                                                [{ text: 'TOTAL', bold: true, fontSize: 10 }, { text: formatMoney(sumTotal), alignment: 'right', bold: true, fontSize: 11 }],
                                                [{ text: 'Registros', fontSize: 9 }, { text: String(entries.length), alignment: 'right', bold: true, fontSize: 9 }],
                                            ],
                                        },
                                        layout: {
                                            hLineWidth: function(i, node) { return (i === 0 || i === node.table.body.length) ? 1.5 : 0.5; },
                                            vLineWidth: function() { return 0; },
                                            hLineColor: function(i, node) { return (i === 0 || i === node.table.body.length) ? '#111' : '#e5e7eb'; },
                                        },
                                    },
                                ],
                                marginLeft: 20,
                            },
                        ],
                    }
                );
            }

            // Signatures
            docDefinition.content.push(
                { text: '', marginTop: 40 },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 555, y2: 0, lineWidth: 0.5 }] },
                { text: '', marginTop: 30 },
                {
                    columns: [
                        {
                            width: '45%',
                            stack: [
                                { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 220, y2: 0, lineWidth: 0.5 }] },
                                { text: 'Recepcionista', fontSize: 8, color: '#666', alignment: 'center', marginTop: 4 },
                            ],
                        },
                        { width: '10%', text: '' },
                        {
                            width: '45%',
                            stack: [
                                { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 220, y2: 0, lineWidth: 0.5 }] },
                                { text: 'Supervisor / Gerente', fontSize: 8, color: '#666', alignment: 'center', marginTop: 4 },
                            ],
                        },
                    ],
                },
                { text: 'Impreso: ' + new Date().toLocaleString('es-MX'), fontSize: 7, color: '#999', alignment: 'right', marginTop: 20 }
            );

            // Generate PDF buffer
            const pdfDoc = printer.createPdfKitDocument(docDefinition);
            const chunks = [];
            pdfDoc.on('data', chunk => chunks.push(chunk));
            pdfDoc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                console.log(`[HP PDF] Generated ${pdfBuffer.length} bytes`);
                resolve(pdfBuffer);
            });
            pdfDoc.on('error', err => reject(err));
            pdfDoc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// POST /print/hp — Print closing report on HP (letter-size)
app.post('/print/hp', async (req, res) => {
    try {
        const { type, data } = req.body;
        console.log(`📄 [HP] Recibiendo trabajo: ${type}`);

        let document;
        switch (type) {
            case 'closing':
                document = buildHPClosingReport(data);
                break;
            case 'income': {
                // Generate PDF and wrap in PJL envelope for HP LaserJet
                const pdfBuffer = await buildHPIncomeReportPDF(data);

                // PJL header tells the HP to interpret data as PDF
                const pjlHeader = Buffer.from(
                    '\x1B%-12345X@PJL\r\n' +
                    '@PJL SET COPIES=1\r\n' +
                    '@PJL ENTER LANGUAGE = PDF\r\n',
                    'ascii'
                );
                // PJL footer / UEL (Universal Exit Language) to end the job
                const pjlFooter = Buffer.from('\x1B%-12345X', 'ascii');

                document = Buffer.concat([pjlHeader, pdfBuffer, pjlFooter]);
                console.log(`[HP PDF] Wrapped in PJL: ${document.length} bytes total (PDF: ${pdfBuffer.length})`);
                break;
            }
            default:
                return res.status(400).json({ error: 'Tipo no soportado para HP. Usa: closing, income' });
        }

        await sendToHPPrinter(document);
        console.log(`✅ [HP] Reporte ${type} impreso correctamente`);
        res.json({ success: true, message: 'Reporte impreso en HP' });

    } catch (error) {
        console.error('❌ [HP] Error:', error);
        res.status(500).json({ error: error.message });
    }
});


// POST /print/hp/test — Test HP printer connectivity
app.post('/print/hp/test', async (req, res) => {
    try {
        let doc = '\x1B%-12345X\x1BE';  // UEL + Reset
        doc += '\x1B&l2A';               // Letter size
        doc += '\x1B(s0P\x1B(s12H\x1B(s3T'; // Courier 12cpi
        doc += '\r\n\r\n';
        doc += '         ====================================\r\n';
        doc += '              PRUEBA DE IMPRESION HP\r\n';
        doc += '         ====================================\r\n';
        doc += '\r\n';
        doc += `         Fecha: ${new Date().toLocaleDateString('es-MX')}\r\n`;
        doc += `         Hora:  ${new Date().toLocaleTimeString('es-MX')}\r\n`;
        doc += `         IP:    ${HP_PRINTER_IP}:${HP_PRINTER_PORT}\r\n`;
        doc += '\r\n';
        doc += '         Impresora HP OK\r\n';
        doc += '\r\n';
        doc += '\x0C\x1BE\x1B%-12345X'; // FF + Reset + UEL
        await sendToHPPrinter(doc);
        console.log('✅ [HP] Prueba completada');
        res.json({ success: true, message: 'Prueba HP completada' });
    } catch (error) {
        console.error('❌ [HP] Error en prueba:', error);
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
