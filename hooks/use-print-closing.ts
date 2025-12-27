"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import type { ClosingTicketData } from '@/lib/services/thermal-printer-service';

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
            const response = await fetch('/api/print-closing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al imprimir ticket de corte');
            }

            toast.success('Ticket de corte impreso', {
                description: 'El ticket de corte se imprimió correctamente'
            });

            return true;

        } catch (err) {
            console.error('Print error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';
            setError(errorMessage);

            toast.error('Error al imprimir', {
                description: errorMessage,
                duration: 5000
            });

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
