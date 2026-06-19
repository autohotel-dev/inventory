"use client";

import { useState } from 'react';
import { sendPrintJob } from '@/lib/print';

// ─── Types ───────────────────────────────────────────────────────────

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
        roomNumber?: string;
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

// ─── Hook ────────────────────────────────────────────────────────────

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
            const result = await sendPrintJob('closing', data, {
                endpoint: '/print-closing',
                rawBody: true,
                successMsg: 'Ticket de corte impreso',
                successDesc: 'Impresión silenciosa completada',
            });
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';
            setError(errorMessage);
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
