"use client";

import { useState, useCallback } from 'react';
import { sendPrintJob, sendTestPrint } from '@/lib/print';

// ─── Ticket Data Types ──────────────────────────────────────────────

interface ConsumptionTicketData {
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

interface EntryTicketData {
    roomNumber: string;
    roomTypeName: string;
    date: Date;
    people: number;
    vehiclePlate?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    basePrice: number;
    extraPeopleCount?: number;
    extraPeopleCost?: number;
    totalPrice: number;
    paymentMethod: string;
    expectedCheckout: Date;
}

interface PaymentTicketData {
    roomNumber?: string;
    date: Date;
    items: Array<{
        name: string;
        qty: number;
        total: number;
    }>;
    total: number;
    paymentMethod: string;
    remainingAmount?: number;
}

interface QRTicketData {
    roomNumber: string;
    url: string;
    title?: string;
}

interface ToleranceTicketData {
    roomNumber: string;
    exitTime: Date;
    returnDeadline: Date;
    people: number;
    toleranceType: 'ROOM_EMPTY' | 'PERSON_LEFT';
}

// ─── Hook Return Type ────────────────────────────────────────────────

interface UseThermalPrinterReturn {
    isPrinting: boolean;
    printStatus: 'idle' | 'printing_reception' | 'printing_client' | 'success' | 'error';
    printConsumptionTickets: (data: ConsumptionTicketData) => Promise<boolean>;
    printCheckoutTicket: (data: ConsumptionTicketData) => Promise<boolean>;
    printEntryTicket: (data: EntryTicketData) => Promise<boolean>;
    printPaymentTicket: (data: PaymentTicketData) => Promise<boolean>;
    printQRTicket: (data: QRTicketData) => Promise<boolean>;
    printToleranceTicket: (data: ToleranceTicketData) => Promise<boolean>;
    printTestTicket: () => Promise<boolean>;
    error: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useThermalPrinter(): UseThermalPrinterReturn {
    const [isPrinting, setIsPrinting] = useState(false);
    const [printStatus, setPrintStatus] = useState<'idle' | 'printing_reception' | 'printing_client' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    // Helper to wrap print calls with state management
    const withPrintState = useCallback(async (
        fn: () => Promise<boolean>,
        statusDuring: typeof printStatus = 'printing_reception',
    ): Promise<boolean> => {
        setIsPrinting(true);
        setError(null);
        setPrintStatus(statusDuring);

        try {
            const result = await fn();
            setPrintStatus(result ? 'success' : 'error');
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';
            setError(errorMessage);
            setPrintStatus('error');
            return false;
        } finally {
            setIsPrinting(false);
        }
    }, []);

    // Consumo: imprime comanda de recepción + ticket de cliente (2 impresiones)
    const printConsumptionTickets = useCallback(async (data: ConsumptionTicketData): Promise<boolean> => {
        return withPrintState(async () => {
            setPrintStatus('printing_reception');
            const receptionOk = await sendPrintJob('reception', data);
            if (!receptionOk) return false;

            // Esperar entre impresiones
            await new Promise(resolve => setTimeout(resolve, 1500));

            setPrintStatus('printing_client');
            const clientOk = await sendPrintJob('client', data, {
                successMsg: 'Tickets impresos',
                successDesc: '✓ Comanda de recepción y ticket de cliente',
            });
            return clientOk;
        });
    }, [withPrintState]);

    // Checkout: imprime 1 solo ticket de SALIDA (solo para recepción)
    const printCheckoutTicket = useCallback(async (data: ConsumptionTicketData): Promise<boolean> => {
        return withPrintState(async () => {
            return sendPrintJob('checkout', data, {
                successMsg: 'Ticket de salida impreso',
                successDesc: `✓ Hab. ${data.roomNumber}`,
            });
        });
    }, [withPrintState]);

    // Entrada: ticket de check-in
    const printEntryTicket = useCallback(async (data: EntryTicketData): Promise<boolean> => {
        return withPrintState(async () => {
            return sendPrintJob('entry', data, {
                successMsg: 'Ticket de entrada impreso',
                successDesc: `✓ Hab. ${data.roomNumber}`,
            });
        });
    }, [withPrintState]);

    // Pago: comprobante de pago (fire-and-forget, sin toast)
    const printPaymentTicket = useCallback(async (data: PaymentTicketData): Promise<boolean> => {
        return withPrintState(async () => {
            return sendPrintJob('payment', data, { silent: true });
        });
    }, [withPrintState]);

    // QR: imprime ticket con QR nativo ESC/POS
    const printQRTicket = useCallback(async (data: QRTicketData): Promise<boolean> => {
        return withPrintState(async () => {
            return sendPrintJob('qr', data);
        });
    }, [withPrintState]);

    // Tolerancia: ticket de salida temporal con hora de regreso
    const printToleranceTicket = useCallback(async (data: ToleranceTicketData): Promise<boolean> => {
        return withPrintState(async () => {
            return sendPrintJob('tolerance', data);
        });
    }, [withPrintState]);

    // Test: prueba de impresión
    const printTestTicket = useCallback(async (): Promise<boolean> => {
        return withPrintState(async () => {
            return sendTestPrint();
        });
    }, [withPrintState]);

    return {
        isPrinting,
        printStatus,
        printConsumptionTickets,
        printCheckoutTicket,
        printEntryTicket,
        printPaymentTicket,
        printQRTicket,
        printToleranceTicket,
        printTestTicket,
        error
    };
}

// Re-exportar los tipos para uso en otros lugares
export type { ConsumptionTicketData, EntryTicketData, PaymentTicketData, QRTicketData, ToleranceTicketData };
