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
        // Configuración para POS-8360 (Fujun) - 80mm papel, Red/Ethernet
        // IP configurada: 192.168.1.100, Puerto: 9100 (estándar ESC/POS)
        this.config = config || {
            type: 'network',
            interface: 'tcp://192.168.1.100:9100',
            printerType: PrinterTypes.EPSON,  // POS-8360 es compatible EPSON ESC/POS
            characterSet: 'PC858_EURO',  // Soporte para español (á, é, í, ó, ú, ñ)
            width: 48  // 80mm paper (48 caracteres por línea)
        };
    }

    private createPrinter(): ThermalPrinter {
        return new ThermalPrinter({
            type: this.config.printerType || PrinterTypes.EPSON,
            interface: this.config.interface || 'tcp://192.168.1.100:9100',
            characterSet: (this.config.characterSet || 'PC437_USA') as any,
            removeSpecialCharacters: false,
            lineCharacter: "=",
            width: this.config.width || 48,
            options: {
                timeout: 5000
            }
        });
    }

    /**
     * Imprime comanda de recepción (control interno)
     */
    async printReceptionTicket(data: ConsumptionTicketData): Promise<void> {
        const printer = this.createPrinter();

        try {
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
            const dateStr = data.date.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const timeStr = data.date.toLocaleTimeString('es-MX', {
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
            printer.println("Items pendientes de pago");
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
            // Header con nombre del hotel
            printer.alignCenter();
            printer.setTextDoubleHeight();
            printer.println(data.hotelName || "HOTEL");
            printer.setTextNormal();
            printer.drawLine();

            printer.alignLeft();

            // Fecha y hora
            const dateStr = data.date.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const timeStr = data.date.toLocaleTimeString('es-MX', {
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
            printer.println("CONSUMO (SIN COBRAR)");
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
            printer.println("Este consumo sera cargado");
            printer.println("a su cuenta de habitacion");
            printer.newLine();
            printer.println("Pendiente de pago al checkout");
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
