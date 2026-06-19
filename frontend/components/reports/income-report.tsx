"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIncomeReport } from "@/hooks/reports/use-income-report";
import { handlePrintHtml, handleCsvExport } from "./income-report/export-utils";
import { IncomeReportHeader } from "./income-report/income-report-header";
import { IncomeReportKpi } from "./income-report/income-report-kpi";
import { IncomeReportTable } from "./income-report/income-report-table";
import { IncomeReportProps } from "./income-report/types";
import { formatCurrency } from "@/lib/utils/formatters";

export function IncomeReport(props: IncomeReportProps) {
    const { reportType, startDate, endDate } = props;
    const [showStats, setShowStats] = useState(true);
    const [page, setPage] = useState(1);
    const pageSize = 50;

    // Reset pagination to page 1 whenever filters change to avoid empty pages
    useEffect(() => {
        setPage(1);
    }, [
        reportType,
        props.shiftId,
        startDate,
        endDate,
        props.paymentMethodFilter,
        props.roomFilter,
        props.statusFilter
    ]);

    const {
        entries,
        totals,
        totalCount,
        loading,
        reportNumber,
        shiftInfo,
        currentShift,
        damageItems,
        fetchAllForPrint
    } = useIncomeReport({ ...props, page, pageSize });

    const getReceptionistName = () => {
        if (shiftInfo?.employee_name) return shiftInfo.employee_name;
        if (currentShift?.employee_name) return currentShift.employee_name;
        return "N/A";
    };

    const getPeriodLabel = () => {
        if (reportType === "shift" && shiftInfo) {
            const start = new Date(shiftInfo.shift_start).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
            const end = shiftInfo.shift_end
                ? new Date(shiftInfo.shift_end).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
                : "En curso";
            return `${start} — ${end}`;
        } else if (reportType === "dateRange") {
            const s = startDate ? startDate.toLocaleDateString("es-MX") : "Inicio";
            const e = endDate ? endDate.toLocaleDateString("es-MX") : "Fin";
            return `${s} — ${e}`;
        }
        return "General";
    };

    const handleExport = async () => {
        const fullData = await fetchAllForPrint();
        handleCsvExport({
            entries: fullData.entries,
            totals: fullData.totals,
            receptionistName: getReceptionistName(),
            periodLabel: getPeriodLabel(),
            reportType,
            shiftInfo,
            startDate,
            endDate
        });
    };

    const onPrintBrowser = async () => {
        const fullData = await fetchAllForPrint();
        handlePrintHtml({
            entries: fullData.entries,
            totals: fullData.totals,
            receptionistName: getReceptionistName(),
            periodLabel: getPeriodLabel(),
            reportType,
            shiftInfo,
            startDate,
            endDate
        });
    };

    const onPrintHp = async () => {
        const fullData = await fetchAllForPrint();
        // Assuming handleHpPrint might be imported in the future or updated, but keeping it same signature
        handlePrintHtml({
            entries: fullData.entries,
            totals: fullData.totals,
            receptionistName: getReceptionistName(),
            periodLabel: getPeriodLabel(),
            reportType,
            shiftInfo,
            startDate,
            endDate
        });
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Cargando reporte...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <IncomeReportHeader
                reportType={reportType}
                shiftInfo={shiftInfo}
                onExport={handleExport}
                onPrintHp={onPrintHp}
                onPrintBrowser={onPrintBrowser}
            />

            <IncomeReportKpi
                showStats={showStats}
                setShowStats={setShowStats}
                totals={totals}
            />

            <IncomeReportTable
                entries={entries}
                totals={totals}
                reportNumber={reportNumber}
                reportType={reportType}
                shiftInfo={shiftInfo}
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
            />

            {damageItems && damageItems.length > 0 && (
                <Card className="print:shadow-none print:border-2 print:border-black mt-4">
                    <CardHeader className="border-b print:border-b-2 print:border-black py-3">
                        <CardTitle className="text-sm font-bold uppercase flex items-center gap-2 text-orange-600 dark:text-orange-500">
                            <span className="p-1 rounded-lg bg-orange-500/10 text-orange-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                                </svg>
                            </span>
                            Detalle de Cobros por Daños
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                                <thead className="bg-muted/50">
                                    <tr className="border-b-2 border-border print:border-b-2 print:border-black">
                                        <th className="border-r border-border p-2 w-12 font-semibold text-center print:border-r print:border-black">No.</th>
                                        <th className="border-r border-border p-2 w-24 font-semibold text-center print:border-r print:border-black">Horario</th>
                                        <th className="border-r border-border p-2 w-24 font-semibold text-center print:border-r print:border-black">Hab.</th>
                                        <th className="border-r border-border p-2 font-semibold text-left print:border-r print:border-black">Motivo / Concepto</th>
                                        <th className="p-2 w-32 font-semibold text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {damageItems.map((dmg, idx) => (
                                        <tr key={dmg.id} className={`border-b border-border hover:bg-muted/30 transition-colors print:border-b print:border-black ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                                            <td className="border-r border-border p-2 text-center print:border-r print:border-black">{idx + 1}</td>
                                            <td className="border-r border-border p-2 text-center print:border-r print:border-black">{dmg.time}</td>
                                            <td className="border-r border-border p-2 text-center font-medium print:border-r print:border-black">{dmg.room_number || "—"}</td>
                                            <td className="border-r border-border p-2 text-left print:border-r print:border-black">{dmg.reason || "Cargo por Daño"}</td>
                                            <td className="p-2 text-right font-mono font-semibold">{formatCurrency(dmg.amount)}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t-2 border-border font-bold bg-muted print:border-t-2 print:border-black">
                                        <td colSpan={4} className="border-r border-border p-3 text-right uppercase print:border-r-2 print:border-black">
                                            TOTAL COBROS POR DAÑO
                                        </td>
                                        <td className="p-3 text-right font-mono text-orange-600 print:text-black">
                                            {formatCurrency(totals.damages || 0)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
