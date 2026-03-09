import { NextResponse } from 'next/server';
import { getNetworkPrinterInstance } from '@/lib/services/network-printer-service';

export async function POST() {
    try {
        const printerService = getNetworkPrinterInstance();
        await printerService.printTest();

        return NextResponse.json({
            success: true,
            message: 'Prueba de impresión completada (silencioso)'
        });

    } catch (error) {
        console.error('Test print error:', error);

        const errorMessage = error instanceof Error
            ? error.message
            : 'Error en prueba de impresión';

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

