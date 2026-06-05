/**
 * Network Printer Service
 * Impresión silenciosa a impresoras térmicas de red via TCP/IP
 * Compatible con impresoras ESC/POS en puerto 9100
 */

import * as net from 'net';

// Configuración de la impresora
const PRINTER_IP = process.env.PRINTER_IP || '192.168.0.106';
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100');
const PRINTER_TIMEOUT = 5000; // 5 segundos

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
    // Inicialización
    INIT: `${ESC}@`,

    // Alineación
    ALIGN_LEFT: `${ESC}a\x00`,
    ALIGN_CENTER: `${ESC}a\x01`,
    ALIGN_RIGHT: `${ESC}a\x02`,

    // Texto
    BOLD_ON: `${ESC}E\x01`,
    BOLD_OFF: `${ESC}E\x00`,
    DOUBLE_HEIGHT: `${GS}!\x10`,
    DOUBLE_WIDTH: `${GS}!\x20`,
    DOUBLE_SIZE: `${GS}!\x30`,
    NORMAL_SIZE: `${GS}!\x00`,

    // Líneas
    NEW_LINE: '\n',

    // Cortar papel
    CUT: `${GS}V\x00`,
    CUT_PARTIAL: `${GS}V\x01`,

    // Línea divisoria (48 caracteres para 80mm)
    DIVIDER: '================================================',
    DIVIDER_DASH: '------------------------------------------------',
    DIVIDER_DOUBLE: '================================',
};

export interface ConsumptionTicketData {
    roomNumber: string;
    folio: string;
    date: Date;
    items: Array<{
        name: string;
        qty: number;
        price: number;
        total: number;
    }>;
    subtotal: number;
    total: number;
    hotelName?: string;
    entranceValet?: string;
    exitValet?: string;
}

export interface ClosingTicketData {
    employeeName: string;
    shiftName: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    totalCash: number;
    totalCardBBVA: number;
    totalCardGetnet: number;
    totalSales: number;
    totalTransactions: number;
    countedCash: number;
    cashDifference: number;
    notes?: string;
    transactions: Array<{
        time: string;
        amount: number;
        paymentMethod: string;
        terminalCode?: string;
        reference?: string;
        concept?: string;
        items?: Array<{
            name: string;
            qty: number;
            unitPrice: number;
            total: number;
        }>;
    }>;
    roomBreakdown?: Record<string, { count: number; total: number }>;
    extraBreakdown?: Record<string, { count: number; total: number }>;
    consumptionBreakdown?: Record<string, { count: number; total: number }>;
    damageBreakdown?: Record<string, { count: number; total: number }>;
    expenses?: Array<{
        time: string;
        type: string;
        description: string;
        amount: number;
        recipient?: string;
    }>;
    totalExpenses?: number;
    employeeCharges?: Array<{
        time: string;
        employeeName: string;
        chargeType: string;
        description: string;
        total: number;
        discountAmount: number;
        paymentMethod: string;
    }>;
    totalEmployeeCharges?: number;
}

/**
 * Envía datos directamente a la impresora via TCP
 */
async function sendToPrinter(data: string): Promise<boolean> {
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
                    // Pequeño delay para asegurar que la impresora reciba todo
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
                reject(new Error(`Error de conexión con impresora: ${err.message}`));
            }
        });

        socket.on('timeout', () => {
            console.error('[PRINTER] Timeout de conexión');
            if (!resolved) {
                resolved = true;
                socket.destroy();
                reject(new Error('Timeout: La impresora no responde'));
            }
        });

        socket.on('close', () => {
            console.log('[PRINTER] Conexión cerrada');
        });

        // Conectar
        socket.connect(PRINTER_PORT, PRINTER_IP);
    });
}

/**
 * Formatea un monto como moneda
 */
function formatMoney(amount: number): string {
    return `$${amount.toFixed(2)}`;
}

/**
 * Crea una línea con texto alineado a izquierda y derecha
 */
function formatLine(left: string, right: string, width: number = 48): string {
    const spaces = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
}

/**
 * Formatea fecha y hora
 */
function formatDateTime(date: Date | string): { dateStr: string; timeStr: string } {
    const d = typeof date === 'string' ? new Date(date) : date;
    return {
        dateStr: d.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }),
        timeStr: d.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
        })
    };
}

/**
 * Genera el ticket de comanda para recepción
 */
function buildReceptionTicket(data: ConsumptionTicketData): string {
    const { dateStr, timeStr } = formatDateTime(data.date);

    let ticket = '';

    // Inicializar impresora
    ticket += COMMANDS.INIT;

    // Header
    ticket += COMMANDS.ALIGN_CENTER;
    ticket += COMMANDS.DOUBLE_SIZE;
    ticket += 'COMANDA' + COMMANDS.NEW_LINE;
    ticket += 'RECEPCION' + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NORMAL_SIZE;
    ticket += COMMANDS.NEW_LINE;

    // Línea divisoria
    ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;

    // Info
    ticket += COMMANDS.ALIGN_LEFT;
    ticket += `Fecha: ${dateStr} - ${timeStr}` + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_ON;
    ticket += `Habitacion: ${data.roomNumber}` + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_OFF;
    ticket += `Folio: ${data.folio}` + COMMANDS.NEW_LINE;

    // Consumos
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_ON;
    ticket += 'CONSUMOS:' + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_OFF;
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;

    // Items
    data.items.forEach(item => {
        const itemText = `${item.qty}x ${item.name}`;
        const priceText = formatMoney(item.total);
        ticket += formatLine(itemText, priceText) + COMMANDS.NEW_LINE;
    });

    // Totales
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;

    if (data.entranceValet || data.exitValet) {
        ticket += COMMANDS.BOLD_ON + 'VALETS:' + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        if (data.entranceValet) ticket += `Entrada: ${data.entranceValet}` + COMMANDS.NEW_LINE;
        if (data.exitValet) ticket += `Salida:  ${data.exitValet}` + COMMANDS.NEW_LINE;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
    }

    ticket += formatLine('SUBTOTAL:', formatMoney(data.subtotal)) + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_ON;
    ticket += formatLine('TOTAL:', formatMoney(data.total)) + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_OFF;

    // Footer
    ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.ALIGN_CENTER;
    ticket += COMMANDS.BOLD_ON;
    ticket += 'Consumo pagado' + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_OFF;
    ticket += 'Entregar ticket al cliente' + COMMANDS.NEW_LINE;
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;

    // Espacios finales y corte
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.CUT;

    return ticket;
}

/**
 * Genera el ticket para el cliente
 */
function buildClientTicket(data: ConsumptionTicketData): string {
    const { dateStr, timeStr } = formatDateTime(data.date);

    let ticket = '';

    // Inicializar impresora
    ticket += COMMANDS.INIT;

    // Header con nombre del hotel
    ticket += COMMANDS.ALIGN_CENTER;
    ticket += COMMANDS.DOUBLE_HEIGHT;
    ticket += (data.hotelName || 'HOTEL') + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NORMAL_SIZE;
    ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;

    // Info
    ticket += COMMANDS.ALIGN_LEFT;
    ticket += `Fecha: ${dateStr} - ${timeStr}` + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_ON;
    ticket += `Habitacion: ${data.roomNumber}` + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_OFF;

    // Título
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.ALIGN_CENTER;
    ticket += COMMANDS.BOLD_ON;
    ticket += COMMANDS.DOUBLE_HEIGHT;
    ticket += 'CONSUMO PAGADO' + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NORMAL_SIZE;
    ticket += COMMANDS.BOLD_OFF;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.ALIGN_LEFT;

    // Items
    data.items.forEach(item => {
        const itemText = `${item.qty}x ${item.name}`;
        const priceText = formatMoney(item.total);
        ticket += formatLine(itemText, priceText) + COMMANDS.NEW_LINE;
    });

    // Totales
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;

    if (data.entranceValet || data.exitValet) {
        if (data.entranceValet) ticket += `Valet Ent: ${data.entranceValet}` + COMMANDS.NEW_LINE;
        if (data.exitValet) ticket += `Valet Sal: ${data.exitValet}` + COMMANDS.NEW_LINE;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
    }

    ticket += formatLine('SUBTOTAL:', formatMoney(data.subtotal)) + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_ON;
    ticket += formatLine('TOTAL:', formatMoney(data.total)) + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_OFF;

    // Pagado
    ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.ALIGN_CENTER;
    ticket += COMMANDS.BOLD_ON;
    ticket += COMMANDS.DOUBLE_SIZE;
    ticket += 'PAGADO' + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NORMAL_SIZE;
    ticket += COMMANDS.BOLD_OFF;

    // Footer
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += 'Gracias por su preferencia' + COMMANDS.NEW_LINE;
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;

    // Espacios finales y corte
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.CUT;

    return ticket;
}

/**
 * Genera ticket de corte de caja
 */
function buildClosingTicket(data: ClosingTicketData): string {
    const { dateStr: startDate, timeStr: startTime } = formatDateTime(data.periodStart);
    const { dateStr: endDate, timeStr: endTime } = formatDateTime(data.periodEnd);

    let ticket = '';

    // Inicializar
    ticket += COMMANDS.INIT;

    // Header
    ticket += COMMANDS.ALIGN_CENTER;
    ticket += COMMANDS.DOUBLE_SIZE;
    ticket += 'CORTE DE CAJA' + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NORMAL_SIZE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_ON;
    ticket += data.shiftName + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_OFF;
    ticket += data.employeeName + COMMANDS.NEW_LINE;
    ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;

    // Periodo
    ticket += COMMANDS.ALIGN_LEFT;
    ticket += `Inicio: ${startDate} ${startTime}` + COMMANDS.NEW_LINE;
    ticket += `Fin:    ${endDate} ${endTime}` + COMMANDS.NEW_LINE;
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;

    // Resumen por método de pago
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.ALIGN_CENTER;
    ticket += COMMANDS.BOLD_ON;
    ticket += 'RESUMEN POR METODO' + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_OFF;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.ALIGN_LEFT;

    // Efectivo
    ticket += COMMANDS.BOLD_ON;
    ticket += 'EFECTIVO' + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_OFF;
    ticket += `  Esperado:   ${formatMoney(data.totalCash)}` + COMMANDS.NEW_LINE;
    ticket += `  Contado:    ${formatMoney(data.countedCash)}` + COMMANDS.NEW_LINE;
    const diffSymbol = data.cashDifference >= 0 ? '+' : '';
    ticket += `  Diferencia: ${diffSymbol}${formatMoney(data.cashDifference)}` + COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;

    // Tarjeta BBVA
    if (data.totalCardBBVA > 0) {
        ticket += COMMANDS.BOLD_ON;
        ticket += 'TARJETA BBVA' + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_OFF;
        ticket += `  Total:      ${formatMoney(data.totalCardBBVA)}` + COMMANDS.NEW_LINE;
        ticket += COMMANDS.NEW_LINE;
    }

    // Tarjeta GETNET
    if (data.totalCardGetnet > 0) {
        ticket += COMMANDS.BOLD_ON;
        ticket += 'TARJETA GETNET' + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_OFF;
        ticket += `  Total:      ${formatMoney(data.totalCardGetnet)}` + COMMANDS.NEW_LINE;
        ticket += COMMANDS.NEW_LINE;
    }

    // Total general
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_ON;
    ticket += formatLine('TOTAL VENTAS:', formatMoney(data.totalSales)) + COMMANDS.NEW_LINE;
    ticket += COMMANDS.BOLD_OFF;
    ticket += `Transacciones: ${data.totalTransactions}` + COMMANDS.NEW_LINE;
    ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;

    // ═══ DESGLOSE POR TIPO DE HABITACIÓN ═══
    if (data.roomBreakdown && Object.keys(data.roomBreakdown).length > 0) {
        ticket += COMMANDS.ALIGN_CENTER + COMMANDS.BOLD_ON + 'HABITACIONES POR TIPO' + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.ALIGN_LEFT;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        let totalRooms = 0, totalRoomAmount = 0;
        Object.entries(data.roomBreakdown).forEach(([typeName, info]) => {
            const { count, total } = info;
            totalRooms += count;
            totalRoomAmount += total;
            const label = `  ${String(count).padStart(2)}  ${typeName}`;
            ticket += formatLine(label, formatMoney(total)) + COMMANDS.NEW_LINE;
        });
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_ON + formatLine(`  ${String(totalRooms).padStart(2)}  TOTAL HAB.`, formatMoney(totalRoomAmount)) + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;
    }

    // ═══ EXTRAS ═══
    if (data.extraBreakdown && Object.keys(data.extraBreakdown).length > 0) {
        ticket += COMMANDS.ALIGN_CENTER + COMMANDS.BOLD_ON + 'EXTRAS' + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.ALIGN_LEFT;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        let totalExtras = 0, totalExtraAmount = 0;
        Object.entries(data.extraBreakdown).forEach(([label, info]) => {
            const { count, total } = info;
            totalExtras += count;
            totalExtraAmount += total;
            const line = `  ${String(count).padStart(2)}  ${label}`;
            ticket += formatLine(line, formatMoney(total)) + COMMANDS.NEW_LINE;
        });
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_ON + formatLine(`  ${String(totalExtras).padStart(2)}  TOTAL EXTRAS`, formatMoney(totalExtraAmount)) + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;
    }

    // ═══ CONSUMOS ═══
    if (data.consumptionBreakdown && Object.keys(data.consumptionBreakdown).length > 0) {
        ticket += COMMANDS.ALIGN_CENTER + COMMANDS.BOLD_ON + 'CONSUMOS' + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.ALIGN_LEFT;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        let totalConsumptions = 0, totalConsumptionAmount = 0;
        Object.entries(data.consumptionBreakdown).forEach(([productName, info]) => {
            const { count, total } = info;
            totalConsumptions += count;
            totalConsumptionAmount += total;
            const name = productName.length > 28 ? productName.substring(0, 27) + '.' : productName;
            const line = `  ${String(count).padStart(2)}  ${name}`;
            ticket += formatLine(line, formatMoney(total)) + COMMANDS.NEW_LINE;
        });
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_ON + formatLine(`  ${String(totalConsumptions).padStart(2)}  TOTAL CONSUMOS`, formatMoney(totalConsumptionAmount)) + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;
    }

    // ═══ DAÑOS COBRADOS ═══
    if (data.damageBreakdown && Object.keys(data.damageBreakdown).length > 0) {
        ticket += COMMANDS.ALIGN_CENTER + COMMANDS.BOLD_ON + 'DAÑOS COBRADOS' + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.ALIGN_LEFT;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        let totalDamagesCount = 0, totalDamageAmount = 0;
        Object.entries(data.damageBreakdown).forEach(([desc, info]) => {
            const { count, total } = info;
            totalDamagesCount += count;
            totalDamageAmount += total;
            const name = desc.length > 28 ? desc.substring(0, 27) + '.' : desc;
            const line = `  ${String(count).padStart(2)}  ${name}`;
            ticket += formatLine(line, formatMoney(total)) + COMMANDS.NEW_LINE;
        });
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_ON + formatLine(`  ${String(totalDamagesCount).padStart(2)}  TOTAL DAÑOS`, formatMoney(totalDamageAmount)) + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;
    }

    // Detalle de transacciones
    if (data.transactions && data.transactions.length > 0) {
        ticket += COMMANDS.NEW_LINE;
        ticket += COMMANDS.ALIGN_CENTER;
        ticket += COMMANDS.BOLD_ON;
        ticket += 'DETALLE DE TRANSACCIONES' + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_OFF;
        ticket += COMMANDS.NEW_LINE;
        ticket += COMMANDS.ALIGN_LEFT;

        // Agrupar por método de pago
        const cashTx = data.transactions.filter(t => t.paymentMethod === 'EFECTIVO');
        const bbvaTx = data.transactions.filter(t =>
            t.paymentMethod === 'TARJETA_BBVA' ||
            (t.paymentMethod === 'TARJETA' && t.terminalCode === 'BBVA')
        );
        const getnetTx = data.transactions.filter(t =>
            t.paymentMethod === 'TARJETA_GETNET' ||
            (t.paymentMethod === 'TARJETA' && t.terminalCode === 'GETNET')
        );

        // Imprimir efectivo
        if (cashTx.length > 0) {
            ticket += COMMANDS.BOLD_ON;
            ticket += `EFECTIVO (${cashTx.length})` + COMMANDS.NEW_LINE;
            ticket += COMMANDS.BOLD_OFF;
            cashTx.forEach((tx, idx) => {
                ticket += `${idx + 1}. ${tx.time}  ${formatMoney(tx.amount)}` + COMMANDS.NEW_LINE;
                if (tx.reference) {
                    ticket += `   Ref: ${tx.reference}` + COMMANDS.NEW_LINE;
                }
                if (tx.items && tx.items.length > 0) {
                    tx.items.forEach(item => {
                        ticket += `   ${item.qty}x ${item.name}` + COMMANDS.NEW_LINE;
                        ticket += `      ${formatMoney(item.unitPrice)} c/u = ${formatMoney(item.total)}` + COMMANDS.NEW_LINE;
                    });
                } else if (tx.concept) {
                    ticket += `   ${tx.concept}` + COMMANDS.NEW_LINE;
                }
            });
            ticket += COMMANDS.NEW_LINE;
        }

        // Imprimir BBVA
        if (bbvaTx.length > 0) {
            ticket += COMMANDS.BOLD_ON;
            ticket += `TARJETA BBVA (${bbvaTx.length})` + COMMANDS.NEW_LINE;
            ticket += COMMANDS.BOLD_OFF;
            bbvaTx.forEach((tx, idx) => {
                ticket += `${idx + 1}. ${tx.time}  ${formatMoney(tx.amount)}` + COMMANDS.NEW_LINE;
                if (tx.reference) {
                    ticket += `   Ref: ${tx.reference}` + COMMANDS.NEW_LINE;
                }
                if (tx.items && tx.items.length > 0) {
                    tx.items.forEach(item => {
                        ticket += `   ${item.qty}x ${item.name}` + COMMANDS.NEW_LINE;
                        ticket += `      ${formatMoney(item.unitPrice)} c/u = ${formatMoney(item.total)}` + COMMANDS.NEW_LINE;
                    });
                } else if (tx.concept) {
                    ticket += `   ${tx.concept}` + COMMANDS.NEW_LINE;
                }
            });
            ticket += COMMANDS.NEW_LINE;
        }

        // Imprimir GETNET
        if (getnetTx.length > 0) {
            ticket += COMMANDS.BOLD_ON;
            ticket += `TARJETA GETNET (${getnetTx.length})` + COMMANDS.NEW_LINE;
            ticket += COMMANDS.BOLD_OFF;
            getnetTx.forEach((tx, idx) => {
                ticket += `${idx + 1}. ${tx.time}  ${formatMoney(tx.amount)}` + COMMANDS.NEW_LINE;
                if (tx.reference) {
                    ticket += `   Ref: ${tx.reference}` + COMMANDS.NEW_LINE;
                }
                if (tx.items && tx.items.length > 0) {
                    tx.items.forEach(item => {
                        ticket += `   ${item.qty}x ${item.name}` + COMMANDS.NEW_LINE;
                        ticket += `      ${formatMoney(item.unitPrice)} c/u = ${formatMoney(item.total)}` + COMMANDS.NEW_LINE;
                    });
                } else if (tx.concept) {
                    ticket += `   ${tx.concept}` + COMMANDS.NEW_LINE;
                }
            });
            ticket += COMMANDS.NEW_LINE;
        }

        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
    }

    // Gastos del turno (si hay)
    if (data.expenses && data.expenses.length > 0) {
        const EXPENSE_LABELS: Record<string, string> = {
            UBER: 'Uber/Transporte', MAINTENANCE: 'Mantenimiento', REPAIR: 'Reparacion',
            SUPPLIES: 'Insumos', PETTY_CASH: 'Caja Chica', OTHER: 'Otro Gasto',
        };
        ticket += COMMANDS.ALIGN_CENTER + COMMANDS.BOLD_ON + 'GASTOS DEL TURNO' + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.ALIGN_LEFT;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        let totalGastos = 0;
        data.expenses.forEach((exp, i) => {
            const label = EXPENSE_LABELS[exp.type] || exp.type || 'Gasto';
            const desc = exp.description.length > 24 ? exp.description.substring(0, 23) + '.' : exp.description;
            ticket += `${i + 1}. ${exp.time}  -${formatMoney(exp.amount)}` + COMMANDS.NEW_LINE;
            ticket += `   ${label}: ${desc}` + COMMANDS.NEW_LINE;
            totalGastos += exp.amount;
        });
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_ON + formatLine('TOTAL GASTOS:', `-${formatMoney(totalGastos)}`) + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_OFF;
        ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;
    }

    // Cargos a empleados (si hay)
    const CHARGE_TYPE_LABELS: Record<string, string> = {
        BREAKFAST: 'Desayuno', LUNCH: 'Comida', CONSUMPTION: 'Consumo',
        PRODUCT: 'Producto', OTHER: 'Otro',
    };
    const CHARGE_PAY_LABELS: Record<string, string> = {
        CASH: 'Efectivo', DEDUCCION_NOMINA: 'Desc.Nom', COURTESY: 'Cortesia',
    };

    if (data.employeeCharges && data.employeeCharges.length > 0) {
        ticket += COMMANDS.ALIGN_CENTER + COMMANDS.BOLD_ON + 'CARGOS A EMPLEADOS' + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.ALIGN_LEFT;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        data.employeeCharges.forEach((c, i) => {
            const typeLbl = CHARGE_TYPE_LABELS[c.chargeType] || c.chargeType;
            const payLbl = CHARGE_PAY_LABELS[c.paymentMethod] || c.paymentMethod;
            ticket += `${i + 1}. ${c.time}  ${c.total === 0 ? 'CORTESIA' : formatMoney(c.total)}` + COMMANDS.NEW_LINE;
            ticket += `   ${typeLbl}: ${c.description}` + COMMANDS.NEW_LINE;
            ticket += `   ${c.employeeName} (${payLbl})` + COMMANDS.NEW_LINE;
        });
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_ON + formatLine('TOTAL CARGOS:', formatMoney(data.totalEmployeeCharges || 0)) + COMMANDS.NEW_LINE + COMMANDS.BOLD_OFF;
        ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;
    }

    // Efectivo Neto
    {
        const totalGastos = (data.expenses || []).reduce((s, e) => s + e.amount, 0);
        const totalChargesCash = (data.employeeCharges || []).filter(c => c.paymentMethod === 'CASH').reduce((s, c) => s + c.total, 0);
        if (totalGastos > 0 || totalChargesCash > 0) {
            ticket += COMMANDS.BOLD_ON;
            ticket += formatLine('EFECTIVO NETO:', formatMoney((data.totalCash || 0) - totalGastos + totalChargesCash)) + COMMANDS.NEW_LINE;
            ticket += COMMANDS.BOLD_OFF;
            ticket += COMMANDS.DIVIDER_DOUBLE + COMMANDS.NEW_LINE;
        }
    }

    // Notas
    if (data.notes && data.notes.trim()) {
        ticket += COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_ON;
        ticket += 'NOTAS:' + COMMANDS.NEW_LINE;
        ticket += COMMANDS.BOLD_OFF;
        ticket += data.notes.trim() + COMMANDS.NEW_LINE;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
    }

    // Footer
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.ALIGN_CENTER;
    const printTime = new Date();
    ticket += `Impreso: ${printTime.toLocaleDateString('es-MX')} ${printTime.toLocaleTimeString('es-MX')}` + COMMANDS.NEW_LINE;
    ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;

    // Espacios y corte
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.NEW_LINE;
    ticket += COMMANDS.CUT;

    return ticket;
}

/**
 * Network Printer Service Class
 */
export class NetworkPrinterService {
    private printerIP: string;
    private printerPort: number;

    constructor(ip?: string, port?: number) {
        this.printerIP = ip || PRINTER_IP;
        this.printerPort = port || PRINTER_PORT;
    }

    /**
     * Imprime comanda de recepción
     */
    async printReceptionTicket(data: ConsumptionTicketData): Promise<void> {
        const ticket = buildReceptionTicket(data);
        await sendToPrinter(ticket);
        console.log('✓ Comanda de recepción impresa silenciosamente');
    }

    /**
     * Imprime ticket para cliente
     */
    async printClientTicket(data: ConsumptionTicketData): Promise<void> {
        const ticket = buildClientTicket(data);
        await sendToPrinter(ticket);
        console.log('✓ Ticket de cliente impreso silenciosamente');
    }

    /**
     * Imprime ambos tickets con delay entre ellos
     */
    async printBothTickets(data: ConsumptionTicketData): Promise<void> {
        await this.printReceptionTicket(data);
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.printClientTicket(data);
        console.log('✓ Ambos tickets impresos silenciosamente');
    }

    /**
     * Imprime ticket de corte de caja
     */
    async printClosingTicket(data: ClosingTicketData): Promise<void> {
        const ticket = buildClosingTicket(data);
        await sendToPrinter(ticket);
        console.log('✓ Ticket de corte impreso silenciosamente');
    }

    /**
     * Prueba de conexión e impresión
     */
    async printTest(): Promise<void> {
        let ticket = '';

        ticket += COMMANDS.INIT;
        ticket += COMMANDS.ALIGN_CENTER;
        ticket += COMMANDS.DOUBLE_SIZE;
        ticket += 'PRUEBA DE IMPRESION' + COMMANDS.NEW_LINE;
        ticket += COMMANDS.NORMAL_SIZE;
        ticket += COMMANDS.NEW_LINE;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        ticket += `Fecha: ${new Date().toLocaleDateString('es-MX')}` + COMMANDS.NEW_LINE;
        ticket += `Hora: ${new Date().toLocaleTimeString('es-MX')}` + COMMANDS.NEW_LINE;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        ticket += COMMANDS.NEW_LINE;
        ticket += 'Impresora configurada correctamente' + COMMANDS.NEW_LINE;
        ticket += `IP: ${this.printerIP}:${this.printerPort}` + COMMANDS.NEW_LINE;
        ticket += COMMANDS.DIVIDER_DASH + COMMANDS.NEW_LINE;
        ticket += COMMANDS.NEW_LINE;
        ticket += COMMANDS.NEW_LINE;
        ticket += COMMANDS.CUT;

        await sendToPrinter(ticket);
        console.log('✓ Prueba de impresión completada');
    }
}

// Singleton instance
let printerInstance: NetworkPrinterService | null = null;

export function getNetworkPrinterInstance(ip?: string, port?: number): NetworkPrinterService {
    if (!printerInstance || ip || port) {
        printerInstance = new NetworkPrinterService(ip, port);
    }
    return printerInstance;
}
