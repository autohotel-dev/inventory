import { NextRequest, NextResponse } from 'next/server';
import { getPrinterInstance, type ConsumptionTicketData } from '@/lib/services/thermal-printer-service';

export async function POST(request: NextRequest) {
    try {
        const { type, data } = await request.json() as {
            type: 'reception' | 'client' | 'both';
            data: ConsumptionTicketData;
        };

        // Obtener instancia de impresora (usa configuración guardada o default)
        const printerService = getPrinterInstance();

        if (type === 'reception') {
            await printerService.printReceptionTicket(data);
        } else if (type === 'client') {
            await printerService.printClientTicket(data);
        } else if (type === 'both') {
            await printerService.printBothTickets(data);
        } else {
            return NextResponse.json(
                { error: 'Tipo de impresión inválido' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Ticket impreso correctamente'
        });

    } catch (error) {
        console.error('Print API error:', error);

        const errorMessage = error instanceof Error
            ? error.message
            : 'Error desconocido al imprimir';

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
