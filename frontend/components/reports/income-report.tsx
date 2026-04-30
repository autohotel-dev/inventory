"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useIncomeReport } from "@/hooks/reports/use-income-report";
import { handlePrintHtml, handleHpPrint, handleCsvExport } from "./income-report/export-utils";
import { IncomeReportHeader } from "./income-report/income-report-header";
import { IncomeReportKpi } from "./income-report/income-report-kpi";
import { IncomeReportTable } from "./income-report/income-report-table";
import { IncomeReportProps } from "./income-report/types";

export function IncomeReport(props: IncomeReportProps) {
    const { reportType, startDate, endDate } = props;
    const [showStats, setShowStats] = useState(true);

    const {
        entries,
        loading,
        reportNumber,
        shiftInfo,
        currentShift,
        calculateTotals
    } = useIncomeReport(props);

    const totals = calculateTotals();

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

    const handleExport = () => {
        handleCsvExport({
            entries,
            totals,
            receptionistName: getReceptionistName(),
            periodLabel: getPeriodLabel(),
            reportType,
            shiftInfo,
            startDate,
            endDate
        });
    };

    const onPrintBrowser = () => {
        handlePrintHtml({
            entries,
            totals,
            receptionistName: getReceptionistName(),
            periodLabel: getPeriodLabel(),
            reportType,
            shiftInfo,
            startDate,
            endDate
        });
    };

    const onPrintHp = () => {
        handleHpPrint({
            entries,
            totals,
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
            />
        </div>
    );
}
