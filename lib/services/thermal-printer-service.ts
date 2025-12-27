// Thermal Printer Service usando ESC/POS protocol
// Compatible con impresoras EPSON, Star, ZJIANG y genéricas

import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';

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
}

export interface PrinterConfig {
    type: 'usb' | 'network' | 'serial';
    interface?: string; // USB deviceID, IP:Port, or Serial port
    printerType?: typeof PrinterTypes[keyof typeof PrinterTypes];
    characterSet?: string;
    width?: number; // 32 (58mm) or 48 (80mm)
}

export class ThermalPrinterService {
    private config: PrinterConfig;

    constructor(config?: PrinterConfig) {
        // Configuración para POS-80 - 80mm papel, USB
        // Impresora detectada: POS-80 (1) en puerto USB002
        this.config = config || {
            type: 'usb',
            interface: '\\\\localhost\\POS-80 (1)',  // Nombre exacto de la impresora en Windows
            printerType: PrinterTypes.EPSON,  // POS-80 es compatible EPSON ESC/POS
            characterSet: 'PC858_EURO',  // Soporte para español (á, é, í, ó, ú, ñ)
            width: 48  // 80mm paper (48 caracteres por línea)
        };
    }

    private createPrinter(): ThermalPrinter {
        const printerConfig: any = {
            type: this.config.printerType || PrinterTypes.EPSON,
            characterSet: (this.config.characterSet || 'PC437_USA') as any,
            removeSpecialCharacters: false,
            lineCharacter: "=",
            width: this.config.width || 48,
            options: {
                timeout: 5000
            }
        };

        // Solo agregar interface si está definida (para USB se auto-detecta)
        if (this.config.interface) {
            printerConfig.interface = this.config.interface;
        }

        return new ThermalPrinter(printerConfig);
    }

    /**
     * Imprime comanda de recepción (control interno)
     */
    async printReceptionTicket(data: ConsumptionTicketData): Promise<void> {
        const printer = this.createPrinter();

        try {
            // Convertir fecha si viene como string desde JSON
            const date = typeof data.date === 'string' ? new Date(data.date) : data.date;

            // Header
            printer.alignCenter();
            printer.setTextDoubleHeight();
            printer.setTextDoubleWidth();
            printer.println("COMANDA");
            printer.println("RECEPCION");
            printer.setTextNormal();
            printer.newLine();

            printer.drawLine();
            printer.alignLeft();

            // Fecha y hora
            const dateStr = date.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const timeStr = date.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit'
            });

            printer.println(`Fecha: ${dateStr} - ${timeStr}`);
            printer.bold(true);
            printer.println(`Habitacion: ${data.roomNumber}`);
            printer.bold(false);
            printer.println(`Folio: ${data.folio}`);
            printer.drawLine();

            // Items
            printer.newLine();
            printer.bold(true);
            printer.println("CONSUMOS:");
            printer.bold(false);
            printer.drawLine();

            data.items.forEach(item => {
                const itemLine = `${item.qty}x ${item.name}`;
                const price = `$${item.total.toFixed(2)}`;

                // Calcular espacios para alinear precio a la derecha
                const maxLineLength = this.config.width || 48;
                const spaces = maxLineLength - itemLine.length - price.length;
                const paddedLine = itemLine + ' '.repeat(Math.max(spaces, 1)) + price;

                printer.println(paddedLine);
            });

            printer.drawLine();

            // Totales
            const subtotalLine = `SUBTOTAL:`;
            const subtotalPrice = `$${data.subtotal.toFixed(2)}`;
            const subtotalSpaces = (this.config.width || 48) - subtotalLine.length - subtotalPrice.length;
            printer.println(subtotalLine + ' '.repeat(Math.max(subtotalSpaces, 1)) + subtotalPrice);

            printer.bold(true);
            const totalLine = `TOTAL:`;
            const totalPrice = `$${data.total.toFixed(2)}`;
            const totalSpaces = (this.config.width || 48) - totalLine.length - totalPrice.length;
            printer.println(totalLine + ' '.repeat(Math.max(totalSpaces, 1)) + totalPrice);
            printer.bold(false);

            printer.drawLine();

            // Footer
            printer.newLine();
            printer.alignCenter();
            printer.println("Consumo pagado");
            printer.println("Entregar ticket al cliente");
            printer.drawLine();

            printer.newLine();
            printer.newLine();
            printer.newLine();
            printer.cut();

            await printer.execute();
            console.log('✓ Comanda de recepción impresa');

        } catch (error) {
            console.error('Error printing reception ticket:', error);
            throw new Error('Error al imprimir comanda de recepción');
        }
    }

    /**
     * Imprime ticket para cliente
     */
    async printClientTicket(data: ConsumptionTicketData): Promise<void> {
        const printer = this.createPrinter();

        try {
            // Convertir fecha si viene como string desde JSON
            const date = typeof data.date === 'string' ? new Date(data.date) : data.date;

            // Header con nombre del hotel
            printer.alignCenter();
            printer.setTextDoubleHeight();
            printer.println(data.hotelName || "HOTEL");
            printer.setTextNormal();
            printer.drawLine();

            printer.alignLeft();

            // Fecha y hora
            const dateStr = date.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const timeStr = date.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit'
            });

            printer.println(`Fecha: ${dateStr} - ${timeStr}`);
            printer.bold(true);
            printer.println(`Habitacion: ${data.roomNumber}`);
            printer.bold(false);
            printer.drawLine();

            // Título
            printer.newLine();
            printer.alignCenter();
            printer.bold(true);
            printer.println("CONSUMO PAGADO");
            printer.bold(false);
            printer.newLine();
            printer.alignLeft();

            // Items
            data.items.forEach(item => {
                const itemLine = `${item.qty}x ${item.name}`;
                const price = `$${item.total.toFixed(2)}`;

                const maxLineLength = this.config.width || 48;
                const spaces = maxLineLength - itemLine.length - price.length;
                const paddedLine = itemLine + ' '.repeat(Math.max(spaces, 1)) + price;

                printer.println(paddedLine);
            });

            printer.drawLine();

            // Totales
            const subtotalLine = `SUBTOTAL:`;
            const subtotalPrice = `$${data.subtotal.toFixed(2)}`;
            const subtotalSpaces = (this.config.width || 48) - subtotalLine.length - subtotalPrice.length;
            printer.println(subtotalLine + ' '.repeat(Math.max(subtotalSpaces, 1)) + subtotalPrice);

            printer.bold(true);
            const totalLine = `TOTAL:`;
            const totalPrice = `$${data.total.toFixed(2)}`;
            const totalSpaces = (this.config.width || 48) - totalLine.length - totalPrice.length;
            printer.println(totalLine + ' '.repeat(Math.max(totalSpaces, 1)) + totalPrice);
            printer.bold(false);

            printer.drawLine();

            // Nota importante
            printer.newLine();
            printer.alignCenter();
            printer.bold(true);
            printer.println("PAGADO");
            printer.bold(false);
            printer.drawLine();

            // Footer
            printer.newLine();
            printer.println("Gracias por su preferencia");
            printer.drawLine();

            printer.newLine();
            printer.newLine();
            printer.newLine();
            printer.cut();

            await printer.execute();
            console.log('✓ Ticket de cliente impreso');

        } catch (error) {
            console.error('Error printing client ticket:', error);
            throw new Error('Error al imprimir ticket de cliente');
        }
    }

    /**
     * Imprime ambos tickets con delay entre ellos
     */
    async printBothTickets(data: ConsumptionTicketData): Promise<void> {
        try {
            // Imprimir comanda de recepción
            await this.printReceptionTicket(data);

            // Esperar 2 segundos entre impresiones
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Imprimir ticket de cliente
            await this.printClientTicket(data);

            console.log('✓ Ambos tickets impresos correctamente');
        } catch (error) {
            console.error('Error printing tickets:', error);
            throw error;
        }
    }

    /**
     * Prueba de impresión
     */
    async printTest(): Promise<void> {
        const printer = this.createPrinter();

        try {
            printer.alignCenter();
            printer.setTextDoubleHeight();
            printer.println("PRUEBA DE IMPRESION");
            printer.setTextNormal();
            printer.newLine();

            printer.alignLeft();
            printer.println(`Fecha: ${new Date().toLocaleDateString('es-MX')}`);
            printer.println(`Hora: ${new Date().toLocaleTimeString('es-MX')}`);
            printer.newLine();

            printer.alignCenter();
            printer.println("Impresora configurada correctamente");
            printer.newLine();
            printer.println("Tipo: " + (this.config.printerType || 'EPSON'));
            printer.println("Conexion: " + (this.config.type || 'network'));
            printer.newLine();
            printer.newLine();
            printer.cut();

            await printer.execute();
            console.log('✓ Prueba de impresión completada');
        } catch (error) {
            console.error('Error en prueba de impresión:', error);
            throw new Error('Error al imprimir prueba');
        }
    }

    /**
     * Imprime ticket de corte de caja
     */
    async printClosingTicket(data: ClosingTicketData): Promise<void> {
        const printer = this.createPrinter();

        try {
            // Convertir fechas si vienen como string
            const periodStart = typeof data.periodStart === 'string' ? new Date(data.periodStart) : data.periodStart;
            const periodEnd = typeof data.periodEnd === 'string' ? new Date(data.periodEnd) : data.periodEnd;

            // ===== HEADER =====
            printer.alignCenter();
            printer.setTextDoubleHeight();
            printer.setTextDoubleWidth();
            printer.println("CORTE DE CAJA");
            printer.setTextNormal();
            printer.newLine();

            printer.bold(true);
            printer.println(data.shiftName);
            printer.bold(false);
            printer.println(data.employeeName);
            printer.drawLine();

            // ===== PERIODO =====
            printer.alignLeft();
            const startDate = periodStart.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const startTime = periodStart.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            const endDate = periodEnd.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const endTime = periodEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

            printer.println(`Inicio: ${startDate} ${startTime}`);
            printer.println(`Fin:    ${endDate} ${endTime}`);
            printer.drawLine();

            // ===== RESUMEN POR METODO DE PAGO =====
            printer.newLine();
            printer.alignCenter();
            printer.bold(true);
            printer.println("RESUMEN POR METODO");
            printer.bold(false);
            printer.newLine();
            printer.alignLeft();

            // Efectivo
            printer.bold(true);
            printer.println("EFECTIVO");
            printer.bold(false);
            printer.println(`  Esperado:  $${data.totalCash.toFixed(2)}`);
            printer.println(`  Contado:   $${data.countedCash.toFixed(2)}`);
            const diffSymbol = data.cashDifference >= 0 ? '+' : '';
            printer.println(`  Diferencia: ${diffSymbol}$${data.cashDifference.toFixed(2)}`);
            printer.newLine();

            // Tarjeta BBVA
            if (data.totalCardBBVA > 0) {
                printer.bold(true);
                printer.println("TARJETA BBVA");
                printer.bold(false);
                printer.println(`  Total:     $${data.totalCardBBVA.toFixed(2)}`);
                printer.newLine();
            }

            // Tarjeta GETNET
            if (data.totalCardGetnet > 0) {
                printer.bold(true);
                printer.println("TARJETA GETNET");
                printer.bold(false);
                printer.println(`  Total:     $${data.totalCardGetnet.toFixed(2)}`);
                printer.newLine();
            }

            printer.drawLine();

            // ===== TOTAL GENERAL =====
            printer.alignLeft();
            const totalLine = `TOTAL VENTAS:`;
            const totalPrice = `$${data.totalSales.toFixed(2)}`;
            const totalSpaces = (this.config.width || 48) - totalLine.length - totalPrice.length;
            printer.bold(true);
            printer.println(totalLine + ' '.repeat(Math.max(totalSpaces, 1)) + totalPrice);
            printer.bold(false);

            printer.println(`Transacciones: ${data.totalTransactions}`);
            printer.drawLine();

            // ===== TRANSACCIONES DETALLADAS =====
            if (data.transactions && data.transactions.length > 0) {
                printer.newLine();
                printer.alignCenter();
                printer.bold(true);
                printer.println("DETALLE DE TRANSACCIONES");
                printer.bold(false);
                printer.newLine();
                printer.alignLeft();

                // Agrupar por método de pago
                const cashTransactions = data.transactions.filter(t => t.paymentMethod === 'EFECTIVO');
                const bbvaTransactions = data.transactions.filter(t =>
                    t.paymentMethod === 'TARJETA' && t.terminalCode === 'BBVA' ||
                    t.paymentMethod === 'TARJETA_BBVA'
                );
                const getnetTransactions = data.transactions.filter(t =>
                    t.paymentMethod === 'TARJETA' && t.terminalCode === 'GETNET' ||
                    t.paymentMethod === 'TARJETA_GETNET'
                );

                // Imprimir EFECTIVO
                if (cashTransactions.length > 0) {
                    printer.bold(true);
                    printer.println(`EFECTIVO (${cashTransactions.length})`);
                    printer.bold(false);
                    cashTransactions.forEach((tx, idx) => {
                        printer.println(`${idx + 1}. ${tx.time}  $${tx.amount.toFixed(2)}`);
                        if (tx.reference) printer.println(`   Ref: ${tx.reference}`);

                        // Mostrar items si están disponibles (formato compacto)
                        if (tx.items && tx.items.length > 0) {
                            tx.items.forEach(item => {
                                // Línea 1: cantidad y nombre
                                printer.println(`   ${item.qty}x ${item.name}`);
                                // Línea 2: precio unitario y total
                                printer.println(`      $${item.unitPrice.toFixed(2)} c/u = $${item.total.toFixed(2)}`);
                            });
                        } else if (tx.concept) {
                            printer.println(`   ${tx.concept}`);
                        }
                    });
                    printer.newLine();
                }

                // Imprimir BBVA
                if (bbvaTransactions.length > 0) {
                    printer.bold(true);
                    printer.println(`TARJETA BBVA (${bbvaTransactions.length})`);
                    printer.bold(false);
                    bbvaTransactions.forEach((tx, idx) => {
                        printer.println(`${idx + 1}. ${tx.time}  $${tx.amount.toFixed(2)}`);
                        if (tx.reference) printer.println(`   Ref: ${tx.reference}`);

                        // Mostrar items si están disponibles (formato compacto)
                        if (tx.items && tx.items.length > 0) {
                            tx.items.forEach(item => {
                                printer.println(`   ${item.qty}x ${item.name}`);
                                printer.println(`      $${item.unitPrice.toFixed(2)} c/u = $${item.total.toFixed(2)}`);
                            });
                        } else if (tx.concept) {
                            printer.println(`   ${tx.concept}`);
                        }
                    });
                    printer.newLine();
                }

                // Imprimir GETNET
                if (getnetTransactions.length > 0) {
                    printer.bold(true);
                    printer.println(`TARJETA GETNET (${getnetTransactions.length})`);
                    printer.bold(false);
                    getnetTransactions.forEach((tx, idx) => {
                        printer.println(`${idx + 1}. ${tx.time}  $${tx.amount.toFixed(2)}`);
                        if (tx.reference) printer.println(`   Ref: ${tx.reference}`);

                        // Mostrar items si están disponibles (formato compacto)
                        if (tx.items && tx.items.length > 0) {
                            tx.items.forEach(item => {
                                printer.println(`   ${item.qty}x ${item.name}`);
                                printer.println(`      $${item.unitPrice.toFixed(2)} c/u = $${item.total.toFixed(2)}`);
                            });
                        } else if (tx.concept) {
                            printer.println(`   ${tx.concept}`);
                        }
                    });
                    printer.newLine();
                }

                printer.drawLine();
            }

            // ===== NOTAS =====
            if (data.notes && data.notes.trim()) {
                printer.newLine();
                printer.alignLeft();
                printer.bold(true);
                printer.println("NOTAS:");
                printer.bold(false);
                printer.println(data.notes.trim());
                printer.drawLine();
            }

            // ===== FOOTER =====
            printer.newLine();
            printer.alignCenter();
            const printTime = new Date();
            printer.println(`Impreso: ${printTime.toLocaleDateString('es-MX')} ${printTime.toLocaleTimeString('es-MX')}`);
            printer.drawLine();

            printer.newLine();
            printer.newLine();
            printer.newLine();
            printer.cut();

            await printer.execute();
            console.log('✓ Ticket de corte impreso');

        } catch (error) {
            console.error('Error printing closing ticket:', error);
            throw new Error('Error al imprimir ticket de corte');
        }
    }
}

// Singleton instance con configuración por defecto
let printerInstance: ThermalPrinterService | null = null;

export function getPrinterInstance(config?: PrinterConfig): ThermalPrinterService {
    if (!printerInstance || config) {
        printerInstance = new ThermalPrinterService(config);
    }
    return printerInstance;
}

// Helper para generar folio único
export function generatePrintFolio(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    return `COM-${year}${month}${day}-${random}`;
}
