import { NextResponse } from 'next/server';
import { getPrinterInstance } from '@/lib/services/thermal-printer-service';

export async function POST() {
    try {
        const printerService = getPrinterInstance();
        await printerService.printTest();

        return NextResponse.json({
            success: true,
            message: 'Prueba de impresión completada'
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
