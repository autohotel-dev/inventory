import { NextRequest, NextResponse } from 'next/server';
import { getPrinterInstance, type ClosingTicketData } from '@/lib/services/thermal-printer-service';

export async function POST(request: NextRequest) {
    try {
        const data = await request.json() as ClosingTicketData;

        // Obtener instancia de impresora
        const printerService = getPrinterInstance();

        // Imprimir ticket de corte
        await printerService.printClosingTicket(data);

        return NextResponse.json({
            success: true,
            message: 'Ticket de corte impreso correctamente'
        });

    } catch (error) {
        console.error('Print closing API error:', error);

        const errorMessage = error instanceof Error
            ? error.message
            : 'Error desconocido al imprimir';

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
