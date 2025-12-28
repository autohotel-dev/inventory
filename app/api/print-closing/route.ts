import { NextRequest, NextResponse } from 'next/server';
import type { ClosingTicketData } from '@/lib/services/thermal-printer-service';

export async function POST(request: NextRequest) {
    try {
        const data = await request.json() as ClosingTicketData;

        // URL del servidor local de impresión
        const printServerUrl = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';

        console.log(`Enviando trabajo de impresión a: ${printServerUrl}/print-closing`);

        // Enviar petición al servidor local
        const response = await fetch(`${printServerUrl}/print-closing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al imprimir en servidor local');
        }

        const result = await response.json();

        return NextResponse.json({
            success: true,
            message: result.message || 'Ticket de corte impreso correctamente'
        });

    } catch (error) {
        console.error('Print closing API error:', error);

        const errorMessage = error instanceof Error
            ? error.message
            : 'Error desconocido al imprimir';

        return NextResponse.json(
            {
                error: errorMessage,
                hint: 'Verifica que el servidor de impresión local esté corriendo en la PC con la impresora'
            },
            { status: 500 }
        );
    }
}
