"use client";

import { useState } from 'react';
import { toast } from 'sonner';

// URL del print-server (env var for Vercel, fallback to localhost for dev)
const PRINT_SERVER_URL = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';

interface ClosingTicketData {
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

interface UsePrintClosingReturn {
    isPrinting: boolean;
    printClosing: (data: ClosingTicketData) => Promise<boolean>;
    error: string | null;
}

export function usePrintClosing(): UsePrintClosingReturn {
    const [isPrinting, setIsPrinting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const printClosing = async (data: ClosingTicketData): Promise<boolean> => {
        setIsPrinting(true);
        setError(null);

        try {
            // Imprimir corte via print-server local
            const response = await fetch(`${PRINT_SERVER_URL}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'closing', data })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al imprimir corte de caja');
            }

            toast.success('Ticket de corte impreso', {
                description: 'Impresión silenciosa completada'
            });

            return true;

        } catch (err) {
            console.error('Print error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';
            setError(errorMessage);

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
    };

    return {
        isPrinting,
        printClosing,
        error
    };
}

// Re-exportar el tipo
export type { ClosingTicketData };
