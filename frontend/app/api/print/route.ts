import { NextRequest, NextResponse } from 'next/server';
import { getNetworkPrinterInstance, type ConsumptionTicketData, type ClosingTicketData } from '@/lib/services/network-printer-service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, data } = body as {
            type: 'reception' | 'client' | 'both' | 'closing';
            data: ConsumptionTicketData | ClosingTicketData;
        };

        // Obtener instancia de impresora de red
        const printerService = getNetworkPrinterInstance();

        if (type === 'reception') {
            await printerService.printReceptionTicket(data as ConsumptionTicketData);
        } else if (type === 'client') {
            await printerService.printClientTicket(data as ConsumptionTicketData);
        } else if (type === 'both') {
            await printerService.printBothTickets(data as ConsumptionTicketData);
        } else if (type === 'closing') {
            await printerService.printClosingTicket(data as ClosingTicketData);
        } else {
            return NextResponse.json(
                { error: 'Tipo de impresión inválido' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Ticket impreso correctamente (silencioso)'
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

