"use client";

import { useEffect, Suspense } from "react";
import { IncomeReport } from "@/components/reports/income-report";
import { useSearchParams } from "next/navigation";

function PrintPageContent() {
    const searchParams = useSearchParams();
    const shiftId = searchParams.get('shiftId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Parsear fechas si existen
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    useEffect(() => {
        // Auto-imprimir cuando cargue
        const timer = setTimeout(() => {
            window.print();
        }, 1000); // 1 segundo de espera para asegurar que los datos carguen

        return () => clearTimeout(timer);
    }, []);

    // Determinar tipo de reporte basado en parámetros
    const reportType = shiftId ? "shift" : "dateRange";

    return (
        <div className="print-page bg-white min-h-screen p-4">
            <style jsx global>{`
                /* Ocultar elementos de UI propios del reporte si es necesario */
                .no-print {
                    display: none !important;
                }
                
                /* Resetear estilos base para impresión limpia */
                body {
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: auto !important;
                }
                
                /* Asegurar visibilidad */
                .print-page {
                    visibility: visible !important;
                    display: block !important;
                    width: 100% !important;
                }
            `}</style>

            <IncomeReport
                reportType={reportType}
                shiftId={shiftId || undefined}
                startDate={startDate}
                endDate={endDate}
            />
        </div>
    );
}

export default function IncomeReportPrintPage() {
    return (
        <Suspense fallback={<div>Cargando reporte para impresión...</div>}>
            <PrintPageContent />
        </Suspense>
    );
}
