"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import type { ClosingTicketData } from '@/lib/services/network-printer-service';

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
            // Imprimir corte de caja silenciosamente via API de red
            const response = await fetch('/api/print', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'closing',
                    data
                })
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
