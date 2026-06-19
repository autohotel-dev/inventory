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
        expenses,
        totalExpenses,
        employeeCharges,
        totalEmployeeCharges,
        totalEmployeeChargesCash,
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

            {/* ─── Gastos del Turno ────────────────────────── */}
            {expenses && expenses.length > 0 && (
                <Card className="print:shadow-none print:border-2 print:border-black mt-4">
                    <CardHeader className="border-b print:border-b-2 print:border-black py-3">
                        <CardTitle className="text-sm font-bold uppercase flex items-center gap-2 text-red-600 dark:text-red-500">
                            <span className="p-1 rounded-lg bg-red-500/10 text-red-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            </span>
                            Gastos del Turno
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                                <thead className="bg-muted/50">
                                    <tr className="border-b-2 border-border print:border-b-2 print:border-black">
                                        <th className="border-r border-border p-2 w-12 font-semibold text-center print:border-r print:border-black">No.</th>
                                        <th className="border-r border-border p-2 w-24 font-semibold text-center print:border-r print:border-black">Tipo</th>
                                        <th className="border-r border-border p-2 font-semibold text-left print:border-r print:border-black">Descripción</th>
                                        <th className="border-r border-border p-2 w-28 font-semibold text-left print:border-r print:border-black">Destinatario</th>
                                        <th className="p-2 w-32 font-semibold text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map((exp: any, idx: number) => (
                                        <tr key={exp.id} className={`border-b border-border hover:bg-muted/30 transition-colors print:border-b print:border-black ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                                            <td className="border-r border-border p-2 text-center print:border-r print:border-black">{idx + 1}</td>
                                            <td className="border-r border-border p-2 text-center print:border-r print:border-black">{exp.expense_type}</td>
                                            <td className="border-r border-border p-2 text-left print:border-r print:border-black">{exp.description}</td>
                                            <td className="border-r border-border p-2 text-left print:border-r print:border-black">{exp.recipient || '—'}</td>
                                            <td className="p-2 text-right font-mono font-semibold">{formatCurrency(Number(exp.amount))}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t-2 border-border font-bold bg-muted print:border-t-2 print:border-black">
                                        <td colSpan={4} className="border-r border-border p-3 text-right uppercase print:border-r-2 print:border-black">
                                            TOTAL GASTOS
                                        </td>
                                        <td className="p-3 text-right font-mono text-red-600 print:text-black">
                                            {formatCurrency(totalExpenses)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Cargos a Empleados ──────────────────────── */}
            {employeeCharges && employeeCharges.length > 0 && (
                <Card className="print:shadow-none print:border-2 print:border-black mt-4">
                    <CardHeader className="border-b print:border-b-2 print:border-black py-3">
                        <CardTitle className="text-sm font-bold uppercase flex items-center gap-2 text-blue-600 dark:text-blue-500">
                            <span className="p-1 rounded-lg bg-blue-500/10 text-blue-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            </span>
                            Cargos a Empleados
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                                <thead className="bg-muted/50">
                                    <tr className="border-b-2 border-border print:border-b-2 print:border-black">
                                        <th className="border-r border-border p-2 w-12 font-semibold text-center print:border-r print:border-black">No.</th>
                                        <th className="border-r border-border p-2 font-semibold text-left print:border-r print:border-black">Empleado</th>
                                        <th className="border-r border-border p-2 font-semibold text-left print:border-r print:border-black">Concepto</th>
                                        <th className="border-r border-border p-2 w-20 font-semibold text-center print:border-r print:border-black">Pago</th>
                                        <th className="p-2 w-28 font-semibold text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employeeCharges.map((ch: any, idx: number) => (
                                        <tr key={ch.id} className={`border-b border-border hover:bg-muted/30 transition-colors print:border-b print:border-black ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                                            <td className="border-r border-border p-2 text-center print:border-r print:border-black">{idx + 1}</td>
                                            <td className="border-r border-border p-2 text-left print:border-r print:border-black">
                                                {ch.charged_employee ? `${ch.charged_employee.first_name} ${ch.charged_employee.last_name}` : '—'}
                                            </td>
                                            <td className="border-r border-border p-2 text-left print:border-r print:border-black">{ch.description}</td>
                                            <td className="border-r border-border p-2 text-center print:border-r print:border-black">
                                                {ch.payment_method === 'CASH' ? '💵' : ch.payment_method === 'DEDUCCION_NOMINA' ? '📋' : '🎁'}
                                            </td>
                                            <td className="p-2 text-right font-mono font-semibold">{formatCurrency(Number(ch.total))}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t-2 border-border font-bold bg-muted print:border-t-2 print:border-black">
                                        <td colSpan={4} className="border-r border-border p-3 text-right uppercase print:border-r-2 print:border-black">
                                            TOTAL CARGOS
                                        </td>
                                        <td className="p-3 text-right font-mono text-blue-600 print:text-black">
                                            {formatCurrency(totalEmployeeCharges)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Resumen de Efectivo Neto ─────────────────── */}
            {(totalExpenses > 0 || totalEmployeeChargesCash > 0) && (
                <Card className="print:shadow-none print:border-2 print:border-black mt-4 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/30">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm font-bold uppercase text-emerald-700 dark:text-emerald-400">
                            Resumen de Efectivo
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Ventas en efectivo:</span>
                            <span className="font-mono font-semibold">{formatCurrency(totals.total - (totals.extra + totals.consumption + (totals.damages || 0)))}</span>
                        </div>
                        {totalExpenses > 0 && (
                            <div className="flex justify-between text-red-600">
                                <span>(-) Gastos del turno:</span>
                                <span className="font-mono font-semibold">-{formatCurrency(totalExpenses)}</span>
                            </div>
                        )}
                        {totalEmployeeChargesCash > 0 && (
                            <div className="flex justify-between text-blue-600">
                                <span>(+) Cargos empleados (efectivo):</span>
                                <span className="font-mono font-semibold">+{formatCurrency(totalEmployeeChargesCash)}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t pt-2 text-base font-bold">
                            <span>Efectivo neto esperado:</span>
                            <span className="font-mono text-emerald-700 dark:text-emerald-400">
                                {formatCurrency((totals.total - (totals.extra + totals.consumption + (totals.damages || 0))) - totalExpenses + totalEmployeeChargesCash)}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
