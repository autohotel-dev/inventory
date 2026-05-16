import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { IncomeEntry, IncomeTotals } from "./types";

interface IncomeReportTableProps {
    entries: IncomeEntry[];
    totals: IncomeTotals;
    reportNumber: string;
    reportType: "shift" | "dateRange";
    shiftInfo: any;
    page?: number;
    pageSize?: number;
    totalCount?: number;
    onPageChange?: (page: number) => void;
}

export function IncomeReportTable({
    entries,
    totals,
    reportNumber,
    reportType,
    shiftInfo,
    page = 1,
    pageSize = 50,
    totalCount = 0,
    onPageChange
}: IncomeReportTableProps) {
    const [expandedRows, setExpandedRows] = useState<number[]>([]);

    const toggleRow = (rowNo: number) => {
        setExpandedRows(prev =>
            prev.includes(rowNo)
                ? prev.filter(r => r !== rowNo)
                : [...prev, rowNo]
        );
    };

    return (
        <Card className="print:shadow-none print:border-2 print:border-black">
            <CardHeader className="text-center border-b print:border-b-2 print:border-black">
                <div className="flex justify-between items-start mb-2 text-xs">
                    <div className="text-left">
                        Fecha: {new Date().toLocaleDateString("es-MX")}
                    </div>
                    <div className="text-right font-bold">
                        N° {reportNumber}
                    </div>
                </div>
                <CardTitle className="text-base font-bold uppercase">
                    Ingresos de Hospedaje y Consumo Público en General
                </CardTitle>
                {reportType === "shift" && shiftInfo && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Turno: {new Date(shiftInfo.shift_start).toLocaleString()} - {shiftInfo.shift_end ? new Date(shiftInfo.shift_end).toLocaleString() : "En curso"}
                    </p>
                )}
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                        <thead className="bg-muted/50">
                            <tr className="border-b-2 border-border print:border-b-2 print:border-black">
                                <th className="border-r border-border p-2 w-12 font-semibold print:border-r-2 print:border-black">No.</th>
                                <th className="border-r border-border p-2 w-20 font-semibold print:border-r-2 print:border-black">Horario</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Placas</th>
                                <th className="border-r border-border p-2 w-20 font-semibold print:border-r-2 print:border-black">Hab.</th>
                                <th className="border-r border-border p-2 w-32 font-semibold print:border-r-2 print:border-black">Recepcionista</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Turno</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Aprobó</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Precio</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Extra</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Consumo</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Total</th>
                                <th className="p-2 w-32 font-semibold">Forma Pago</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, idx) => (
                                <React.Fragment key={entry.no}>
                                    <tr className={`border-b border-border hover:bg-muted/30 transition-colors print:border-b print:border-black ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                                        <td className="border-r border-border p-2 text-center font-medium print:border-r print:border-black">{entry.no}</td>
                                        <td className="border-r border-border p-2 text-center print:border-r print:border-black">{entry.time}</td>
                                        <td className="border-r border-border p-2 text-center uppercase print:border-r print:border-black">{entry.vehicle_plate}</td>
                                        <td className="border-r border-border p-2 text-center font-medium print:border-r print:border-black">
                                            <div className="flex items-center justify-center gap-2">
                                                <span>{entry.room_number}</span>
                                                {entry.stay_status === "ACTIVA" && (
                                                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 print:hidden">
                                                        EN CURSO
                                                    </Badge>
                                                )}
                                                {entry.stay_status === "CANCELADA" && (
                                                    <Badge variant="destructive" className="text-[10px] print:hidden">
                                                        CANCELADA
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="border-r border-border p-2 text-center text-[10px] text-muted-foreground print:border-r print:border-black capitalize">
                                            {entry.receptionist_name || "—"}
                                        </td>
                                        <td className="border-r border-border p-2 text-center text-[10px] text-muted-foreground print:border-r print:border-black">
                                            {entry.shift_name || "—"}
                                        </td>
                                        <td className="border-r border-border p-2 text-center text-[10px] text-muted-foreground print:border-r print:border-black capitalize">
                                            {entry.checkout_valet_name || "—"}
                                        </td>
                                        <td className="border-r border-border p-2 text-right print:border-r print:border-black">
                                            {entry.room_price > 0 ? <span className="font-mono">{formatCurrency(entry.room_price)}</span> : "-"}
                                        </td>
                                        <td className="border-r border-border p-2 text-right print:border-r print:border-black">
                                            {entry.extra > 0 ? <span className="font-mono text-blue-600 print:text-black">{formatCurrency(entry.extra)}</span> : "-"}
                                        </td>
                                        <td className="border-r border-border p-2 text-right print:border-r print:border-black">
                                            {entry.consumption > 0 ? <span className="font-mono text-amber-600 print:text-black">{formatCurrency(entry.consumption)}</span> : "-"}
                                        </td>
                                        <td className="border-r border-border p-2 text-right font-semibold print:border-r print:border-black">
                                            <span className="font-mono">{formatCurrency(entry.total)}</span>
                                        </td>
                                        <td className="p-2 text-center">
                                            {entry.payment_method === "PENDIENTE" ? (
                                                <Badge variant="destructive" className="text-xs">
                                                    PENDIENTE
                                                </Badge>
                                            ) : entry.payment_method === "MIXTO" ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 gap-1 px-2 hover:bg-muted"
                                                    onClick={() => toggleRow(entry.no)}
                                                >
                                                    <Badge variant="secondary" className="text-xs pointer-events-none">
                                                        MIXTO
                                                    </Badge>
                                                    {expandedRows.includes(entry.no) ? (
                                                        <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                    )}
                                                </Button>
                                            ) : entry.payment_method === "EFECTIVO" ? (
                                                <Badge className="text-xs bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:text-white">
                                                    EFECTIVO
                                                </Badge>
                                            ) : entry.payment_method === "TARJETA" ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="flex items-center gap-1">
                                                        <Badge variant="outline" className="text-xs">
                                                            {entry.terminal_code || "TARJETA"}
                                                        </Badge>
                                                        {entry.card_type && (
                                                            <span className="text-[10px] font-bold text-muted-foreground border px-1 rounded">
                                                                {entry.card_type === "CREDITO" ? "CRÉD" : "DÉB"}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {entry.card_last_4 && (
                                                        <span className="text-xs font-mono text-muted-foreground">•••• {entry.card_last_4}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">{entry.payment_method || "-"}</span>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedRows.includes(entry.no) && entry.payments && (
                                        <tr className="bg-muted/30 print:hidden animate-in fade-in-0 slide-in-from-top-1">
                                            <td colSpan={11} className="p-0 border-r border-border"></td>
                                            <td className="p-2 border-b border-border bg-muted/30 shadow-inner">
                                                <div className="space-y-1">
                                                    {entry.payments.map((p: any, pIdx: number) => (
                                                        <div key={pIdx} className="flex justify-between items-center text-xs p-1 rounded hover:bg-background/50">
                                                            <span className="text-muted-foreground font-medium flex items-center gap-1">
                                                                {p.payment_method === "EFECTIVO" ? (
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                ) : (
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                                )}
                                                                {p.payment_method}
                                                                {p.payment_method === 'TARJETA' && (
                                                                    <span className="ml-1 text-[10px] opacity-70">
                                                                        ({p.terminal_code || 'T.P.V'} • {p.card_type === 'CREDITO' ? 'CRÉD.' : 'DÉB.'} •••• {p.card_last_4})
                                                                    </span>
                                                                )}:
                                                            </span>
                                                            <span className="font-mono font-medium">{formatCurrency(p.amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}

                            {entries.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="p-8 text-center text-muted-foreground">
                                        No hay registros para mostrar
                                    </td>
                                </tr>
                            )}

                            <tr className="border-t-2 border-border font-bold bg-muted print:border-t-2 print:border-black">
                                <td colSpan={7} className="border-r border-border p-3 text-right uppercase print:border-r-2 print:border-black">
                                    SUMA TOTAL
                                </td>
                                <td className="border-r border-border p-3 text-right print:border-r-2 print:border-black">
                                    <span className="font-mono">{formatCurrency(totals.roomPrice)}</span>
                                </td>
                                <td className="border-r border-border p-3 text-right print:border-r-2 print:border-black">
                                    <span className="font-mono">{formatCurrency(totals.extra)}</span>
                                </td>
                                <td className="border-r border-border p-3 text-right print:border-r-2 print:border-black">
                                    <span className="font-mono">{formatCurrency(totals.consumption)}</span>
                                </td>
                                <td className="border-r border-border p-3 text-right print:border-r-2 print:border-black">
                                    <span className="font-mono text-emerald-600 print:text-black">{formatCurrency(totals.total)}</span>
                                </td>
                                <td className="p-3"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                {onPageChange && totalCount > pageSize && (
                    <div className="flex items-center justify-between px-4 py-3 border-t print:hidden">
                        <div className="text-sm text-muted-foreground">
                            Mostrando <span className="font-medium">{Math.min((page - 1) * pageSize + 1, totalCount)}</span> a <span className="font-medium">{Math.min(page * pageSize, totalCount)}</span> de <span className="font-medium">{totalCount}</span> registros
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(page - 1)}
                                disabled={page <= 1}
                            >
                                Anterior
                            </Button>
                            <div className="text-sm font-medium px-2">
                                Página {page} de {Math.ceil(totalCount / pageSize)}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(page + 1)}
                                disabled={page >= Math.ceil(totalCount / pageSize)}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
