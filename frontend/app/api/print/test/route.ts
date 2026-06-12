import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getNetworkPrinterInstance } from '@/lib/services/network-printer-service';

export async function POST() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

