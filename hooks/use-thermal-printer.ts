"use client";

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { ConsumptionTicketData } from '@/lib/services/thermal-printer-service';

interface UseThermalPrinterReturn {
    isPrinting: boolean;
    printStatus: 'idle' | 'printing_reception' | 'printing_client' | 'success' | 'error';
    printConsumptionTickets: (data: ConsumptionTicketData) => Promise<boolean>;
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
            // Imprimir comanda de recepción
            setPrintStatus('printing_reception');

            const receptionResponse = await fetch('/api/print', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'reception',
                    data
                })
            });

            if (!receptionResponse.ok) {
                const errorData = await receptionResponse.json();
                throw new Error(errorData.error || 'Error al imprimir comanda de recepción');
            }

            // Esperar 2 segundos entre impresiones
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Imprimir ticket de cliente
            setPrintStatus('printing_client');

            const clientResponse = await fetch('/api/print', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'client',
                    data
                })
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

            toast.error('Error al imprimir', {
                description: errorMessage,
                duration: 5000
            });

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
            const response = await fetch('/api/print/test', {
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

            toast.error('Error en prueba de impresión', {
                description: errorMessage
            });

            return false;
        } finally {
            setIsPrinting(false);
        }
    }, []);

    return {
        isPrinting,
        printStatus,
        printConsumptionTickets,
        printTestTicket,
        error
    };
}
