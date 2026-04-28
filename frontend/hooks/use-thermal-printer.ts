"use client";

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// URL del print-server - configurable via variable de entorno
// Para producción: apuntar a la IP de la PC donde corre el print-server
const PRINT_SERVER_URL = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';

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

interface UseThermalPrinterReturn {
    isPrinting: boolean;
    printStatus: 'idle' | 'printing_reception' | 'printing_client' | 'success' | 'error';
    printConsumptionTickets: (data: ConsumptionTicketData) => Promise<boolean>;
    printCheckoutTicket: (data: ConsumptionTicketData) => Promise<boolean>;
    printEntryTicket: (data: EntryTicketData) => Promise<boolean>;
    printPaymentTicket: (data: PaymentTicketData) => Promise<boolean>;
    printQRTicket: (data: QRTicketData) => Promise<boolean>;
    printTestTicket: () => Promise<boolean>;
    error: string | null;
}

export function useThermalPrinter(): UseThermalPrinterReturn {
    const [isPrinting, setIsPrinting] = useState(false);
    const [printStatus, setPrintStatus] = useState<'idle' | 'printing_reception' | 'printing_client' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    const printConsumptionTickets = useCallback(async (data: ConsumptionTicketData): Promise<boolean> => {
        setIsPrinting(true);
        setError(null);

        try {
            // Imprimir comanda de recepción via print-server local
            setPrintStatus('printing_reception');

            const receptionResponse = await fetch(`${PRINT_SERVER_URL}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'reception', data })
            });

            if (!receptionResponse.ok) {
                const errorData = await receptionResponse.json();
                throw new Error(errorData.error || 'Error al imprimir comanda de recepción');
            }

            // Esperar entre impresiones
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Imprimir ticket de cliente
            setPrintStatus('printing_client');

            const clientResponse = await fetch(`${PRINT_SERVER_URL}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'client', data })
            });

            if (!clientResponse.ok) {
                const errorData = await clientResponse.json();
                throw new Error(errorData.error || 'Error al imprimir ticket de cliente');
            }

            setPrintStatus('success');
            toast.success('Tickets impresos', {
                description: '✓ Comanda de recepción y ticket de cliente'
            });

            return true;

        } catch (err) {
            console.error('Print error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';
            setError(errorMessage);
            setPrintStatus('error');

            // Verificar si es error de conexión al print-server
            if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
                toast.error('Print-server no disponible', {
                    description: 'Verifica que el print-server esté corriendo en localhost:3001',
                    duration: 8000
                });
            } else {
                toast.error('Error al imprimir', {
                    description: errorMessage,
                    duration: 5000
                });
            }

            return false;
        } finally {
            setIsPrinting(false);
        }
    }, []);

    // Checkout: imprime 1 solo ticket de SALIDA (solo para recepción)
    const printCheckoutTicket = useCallback(async (data: ConsumptionTicketData): Promise<boolean> => {
        setIsPrinting(true);
        setError(null);
        setPrintStatus('printing_reception');

        try {
            const response = await fetch(`${PRINT_SERVER_URL}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'checkout', data })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al imprimir ticket de salida');
            }

            setPrintStatus('success');
            toast.success('Ticket de salida impreso', {
                description: `✓ Hab. ${data.roomNumber}`
            });
            return true;
        } catch (err) {
            console.error('Checkout print error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';
            setError(errorMessage);
            setPrintStatus('error');

            if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
                toast.error('Print-server no disponible', {
                    description: 'Verifica que el print-server esté corriendo',
                    duration: 8000
                });
            } else {
                toast.error('Error al imprimir salida', {
                    description: errorMessage,
                    duration: 5000
                });
            }
            return false;
        } finally {
            setIsPrinting(false);
        }
    }, []);

    const printEntryTicket = useCallback(async (data: EntryTicketData): Promise<boolean> => {
        setIsPrinting(true);
        setError(null);
        setPrintStatus('printing_reception');

        try {
            const response = await fetch(`${PRINT_SERVER_URL}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'entry', data })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al imprimir ticket de entrada');
            }

            setPrintStatus('success');
            toast.success('Ticket de entrada impreso', {
                description: `✓ Hab. ${data.roomNumber}`
            });

            return true;
        } catch (err) {
            console.error('Entry print error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';
            setError(errorMessage);
            setPrintStatus('error');

            if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
                toast.error('Print-server no disponible', {
                    description: 'Verifica que el print-server esté corriendo',
                    duration: 8000
                });
            } else {
                toast.error('Error al imprimir entrada', {
                    description: errorMessage,
                    duration: 5000
                });
            }

            return false;
        } finally {
            setIsPrinting(false);
        }
    }, []);

    const printPaymentTicket = useCallback(async (data: PaymentTicketData): Promise<boolean> => {
        setIsPrinting(true);
        setError(null);
        setPrintStatus('printing_reception');

        try {
            const response = await fetch(`${PRINT_SERVER_URL}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'payment', data })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al imprimir comprobante de pago');
            }

            setPrintStatus('success');
            return true;
        } catch (err) {
            console.error('Payment print error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';
            setError(errorMessage);
            setPrintStatus('error');
            // No mostrar toast para pagos - es fire-and-forget
            return false;
        } finally {
            setIsPrinting(false);
        }
    }, []);

    const printTestTicket = useCallback(async (): Promise<boolean> => {
        setIsPrinting(true);
        setError(null);
        setPrintStatus('printing_reception');

        try {
            const response = await fetch(`${PRINT_SERVER_URL}/print/test`, {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error en prueba de impresión');
            }

            setPrintStatus('success');
            toast.success('Prueba de impresión completada', {
                description: 'La impresora está configurada correctamente'
            });

            return true;

        } catch (err) {
            console.error('Test print error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            setError(errorMessage);
            setPrintStatus('error');

            if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
                toast.error('Print-server no disponible', {
                    description: 'Asegúrate de que el print-server esté corriendo',
                    duration: 8000
                });
            } else {
                toast.error('Error en prueba de impresión', {
                    description: errorMessage
                });
            }

            return false;
        } finally {
            setIsPrinting(false);
        }
    }, []);

    // QR: imprime ticket con QR nativo ESC/POS
    const printQRTicket = useCallback(async (data: QRTicketData): Promise<boolean> => {
        setIsPrinting(true);
        setError(null);
        setPrintStatus('printing_reception');

        try {
            const response = await fetch(`${PRINT_SERVER_URL}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'qr', data })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al imprimir QR');
            }

            setPrintStatus('success');
            return true;
        } catch (err) {
            console.error('QR print error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';
            setError(errorMessage);
            setPrintStatus('error');

            if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
                toast.error('Print-server no disponible', {
                    description: 'Verifica que el print-server esté corriendo',
                    duration: 8000
                });
            }
            return false;
        } finally {
            setIsPrinting(false);
        }
    }, []);

    return {
        isPrinting,
        printStatus,
        printConsumptionTickets,
        printCheckoutTicket,
        printEntryTicket,
        printPaymentTicket,
        printQRTicket,
        printTestTicket,
        error
    };
}

// Re-exportar los tipos para uso en otros lugares
export type { ConsumptionTicketData, EntryTicketData, PaymentTicketData, QRTicketData };

