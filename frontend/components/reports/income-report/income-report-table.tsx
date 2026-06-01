import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Package, Clock, CreditCard, RefreshCw, AlertTriangle } from "lucide-react";
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

function formatTime(isoString: string | undefined): string {
    if (!isoString) return "—";
    try {
        return new Date(isoString).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "—";
    }
}

const DELIVERY_STATUS_MAP: Record<string, { label: string; color: string }> = {
    "PENDING_VALET": { label: "Pendiente", color: "bg-amber-500/10 text-amber-600 border-amber-300" },
    "ACCEPTED": { label: "Aceptado", color: "bg-blue-500/10 text-blue-600 border-blue-300" },
    "PICKED_UP": { label: "Recogido", color: "bg-indigo-500/10 text-indigo-600 border-indigo-300" },
    "COMPLETED": { label: "Entregado", color: "bg-emerald-500/10 text-emerald-600 border-emerald-300" },
};

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

    const hasDetails = (entry: IncomeEntry) => {
        return (entry.consumption_details && entry.consumption_details.length > 0) ||
               (entry.extra_details && entry.extra_details.length > 0) ||
               (entry.payments && entry.payments.length > 1);
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
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Dio Entrada</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Aprobó Salida</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Precio Hab.</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Extra</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Consumo</th>
                                <th className="border-r border-border p-2 w-24 font-semibold print:border-r-2 print:border-black">Total</th>
                                <th className="p-2 w-32 font-semibold">Forma Pago</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, idx) => (
                                <React.Fragment key={entry.no}>
                                    <tr
                                        className={`border-b border-border hover:bg-muted/30 transition-colors print:border-b print:border-black ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'} ${hasDetails(entry) ? 'cursor-pointer' : ''}`}
                                        onClick={() => hasDetails(entry) && toggleRow(entry.no)}
                                    >
                                        <td className="border-r border-border p-2 text-center font-medium print:border-r print:border-black">
                                            <div className="flex items-center justify-center gap-1">
                                                {hasDetails(entry) && (
                                                    expandedRows.includes(entry.no)
                                                        ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                                        : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                )}
                                                {entry.no}
                                            </div>
                                        </td>
                                        <td className="border-r border-border p-2 text-center print:border-r print:border-black">{entry.time}</td>
                                        <td className="border-r border-border p-2 text-center uppercase print:border-r print:border-black">{entry.vehicle_plate}</td>
                                        <td className="border-r border-border p-2 text-center font-medium print:border-r print:border-black">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex items-center gap-1">
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
                                                {entry.is_from_previous_shift && (
                                                    <Badge variant="outline" className="text-[9px] bg-violet-50 text-violet-600 border-violet-300 print:hidden gap-0.5">
                                                        <RefreshCw className="h-2.5 w-2.5" />
                                                        {entry.original_checkin_employee}
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
                                            {entry.checkin_valet_name || "—"}
                                        </td>
                                        <td className="border-r border-border p-2 text-center text-[10px] text-muted-foreground print:border-r print:border-black capitalize">
                                            {entry.checkout_valet_name || "—"}
                                        </td>
                                        <td className="border-r border-border p-2 text-right print:border-r print:border-black">
                                            {entry.room_price > 0 ? <span className="font-mono">{formatCurrency(entry.room_price)}</span> : "—"}
                                        </td>
                                        <td className="border-r border-border p-2 text-right print:border-r print:border-black">
                                            {entry.extra > 0 ? <span className="font-mono text-blue-600 print:text-black">{formatCurrency(entry.extra)}</span> : "—"}
                                        </td>
                                        <td className="border-r border-border p-2 text-right print:border-r print:border-black">
                                            {entry.consumption > 0 ? <span className="font-mono text-amber-600 print:text-black">{formatCurrency(entry.consumption)}</span> : "—"}
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
                                                <Badge variant="secondary" className="text-xs">
                                                    MIXTO
                                                </Badge>
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

                                    {/* ─── Expanded Detail Rows ───────────────────────────── */}
                                    {expandedRows.includes(entry.no) && (
                                        <tr className="bg-muted/20 print:hidden animate-in fade-in-0 slide-in-from-top-1">
                                            <td colSpan={13} className="p-0">
                                                <div className="p-3 space-y-3 border-b-2 border-border/50">

                                                    {/* ─── Consumptions Detail ──────────────── */}
                                                    {entry.consumption_details && entry.consumption_details.length > 0 && (
                                                        <div className="rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden">
                                                            <div className="bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 flex items-center gap-2">
                                                                <Package className="h-3.5 w-3.5 text-amber-600" />
                                                                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                                                                    Consumos ({entry.consumption_details.length})
                                                                </span>
                                                                <span className="ml-auto text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400">
                                                                    {formatCurrency(entry.consumption)}
                                                                </span>
                                                            </div>
                                                            <table className="w-full text-[11px]">
                                                                <thead>
                                                                    <tr className="bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800">
                                                                        <th className="px-3 py-1 text-left font-medium text-muted-foreground">Producto</th>
                                                                        <th className="px-2 py-1 text-center font-medium text-muted-foreground">Cant.</th>
                                                                        <th className="px-2 py-1 text-right font-medium text-muted-foreground">P. Unit.</th>
                                                                        <th className="px-2 py-1 text-right font-medium text-muted-foreground">Total</th>
                                                                        <th className="px-2 py-1 text-center font-medium text-muted-foreground">Hora</th>
                                                                        <th className="px-2 py-1 text-center font-medium text-muted-foreground">Estado</th>
                                                                        <th className="px-2 py-1 text-left font-medium text-muted-foreground">Aceptó</th>
                                                                        <th className="px-2 py-1 text-left font-medium text-muted-foreground">Entregó</th>
                                                                        <th className="px-2 py-1 text-left font-medium text-muted-foreground">Cobró</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {entry.consumption_details.map((c, i) => (
                                                                        <tr key={i} className="border-b border-amber-100 dark:border-amber-900/30 last:border-b-0 hover:bg-amber-50/30 dark:hover:bg-amber-950/10">
                                                                            <td className="px-3 py-1.5 font-medium">{c.product_name}</td>
                                                                            <td className="px-2 py-1.5 text-center">{c.qty}</td>
                                                                            <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(c.unit_price)}</td>
                                                                            <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatCurrency(c.total)}</td>
                                                                            <td className="px-2 py-1.5 text-center text-muted-foreground">{formatTime(c.created_at)}</td>
                                                                            <td className="px-2 py-1.5 text-center">
                                                                                {(() => {
                                                                                    const s = DELIVERY_STATUS_MAP[c.delivery_status];
                                                                                    return s ? (
                                                                                        <Badge variant="outline" className={`text-[9px] ${s.color}`}>{s.label}</Badge>
                                                                                    ) : (
                                                                                        <span className="text-muted-foreground">{c.delivery_status}</span>
                                                                                    );
                                                                                })()}
                                                                            </td>
                                                                            <td className="px-2 py-1.5 capitalize">
                                                                                {c.accepted_by_name ? (
                                                                                    <span className="text-muted-foreground">{c.accepted_by_name}</span>
                                                                                ) : c.delivery_status === 'COMPLETED' ? (
                                                                                    <span
                                                                                        className="inline-flex items-center gap-1 text-red-500 cursor-help"
                                                                                        title={`⚠ Protocolo omitido: El paso de "Aceptar pedido" no fue registrado por ningún cochero. El pedido fue completado sin confirmación de aceptación. Esto indica que el cochero entregó el producto sin seguir el flujo establecido de: Solicitar → Aceptar → Recoger → Entregar.`}
                                                                                    >
                                                                                        <AlertTriangle className="h-3 w-3" />
                                                                                        <span className="text-[9px] font-semibold">Omitido</span>
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-muted-foreground">—</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-2 py-1.5 capitalize">
                                                                                {c.picked_up_by_name ? (
                                                                                    <span className="text-muted-foreground">{c.picked_up_by_name}</span>
                                                                                ) : c.delivery_status === 'COMPLETED' ? (
                                                                                    <span
                                                                                        className="inline-flex items-center gap-1 text-red-500 cursor-help"
                                                                                        title={`⚠ Protocolo omitido: El paso de "Recoger pedido" no fue registrado.${c.accepted_by_name ? ` El cochero ${c.accepted_by_name} aceptó el pedido pero no registró la recogida antes de entregarlo.` : ' Ningún cochero registró la recogida del producto.'} El flujo correcto es: Solicitar → Aceptar → Recoger → Entregar.`}
                                                                                    >
                                                                                        <AlertTriangle className="h-3 w-3" />
                                                                                        <span className="text-[9px] font-semibold">Omitido</span>
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-muted-foreground">—</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-2 py-1.5 capitalize">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-medium">{c.payment_by_name || "—"}</span>
                                                                                    {c.payment_at && (
                                                                                        <span className="text-[9px] text-muted-foreground">{formatTime(c.payment_at)}</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}

                                                    {/* ─── Extras Detail ───────────────────── */}
                                                    {entry.extra_details && entry.extra_details.length > 0 && (
                                                        <div className="rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                                                            <div className="bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 flex items-center gap-2">
                                                                <Clock className="h-3.5 w-3.5 text-blue-600" />
                                                                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                                                                    Extras ({entry.extra_details.length})
                                                                </span>
                                                                <span className="ml-auto text-[11px] font-mono font-bold text-blue-700 dark:text-blue-400">
                                                                    {formatCurrency(entry.extra)}
                                                                </span>
                                                            </div>
                                                            <table className="w-full text-[11px]">
                                                                <thead>
                                                                    <tr className="bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800">
                                                                        <th className="px-3 py-1 text-left font-medium text-muted-foreground">Concepto</th>
                                                                        <th className="px-2 py-1 text-center font-medium text-muted-foreground">Cant.</th>
                                                                        <th className="px-2 py-1 text-right font-medium text-muted-foreground">P. Unit.</th>
                                                                        <th className="px-2 py-1 text-right font-medium text-muted-foreground">Total</th>
                                                                        <th className="px-2 py-1 text-center font-medium text-muted-foreground">Hora</th>
                                                                        <th className="px-2 py-1 text-left font-medium text-muted-foreground">Registró</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {entry.extra_details.map((x, i) => (
                                                                        <tr key={i} className="border-b border-blue-100 dark:border-blue-900/30 last:border-b-0 hover:bg-blue-50/30 dark:hover:bg-blue-950/10">
                                                                            <td className="px-3 py-1.5 font-medium">{x.concept_label}</td>
                                                                            <td className="px-2 py-1.5 text-center">{x.qty}</td>
                                                                            <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(x.unit_price)}</td>
                                                                            <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatCurrency(x.total)}</td>
                                                                            <td className="px-2 py-1.5 text-center text-muted-foreground">{formatTime(x.created_at)}</td>
                                                                            <td className="px-2 py-1.5 text-muted-foreground capitalize">{x.registered_by_name || "—"}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}

                                                    {/* ─── Payments Detail ─────────────────── */}
                                                    {entry.payments && entry.payments.length > 0 && (
                                                        <div className="rounded-lg border border-border overflow-hidden">
                                                            <div className="bg-muted/40 px-3 py-1.5 flex items-center gap-2">
                                                                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                                                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                                                    Pagos ({entry.payments.length})
                                                                </span>
                                                                <span className="ml-auto text-[11px] font-mono font-bold">
                                                                    {formatCurrency(entry.total)}
                                                                </span>
                                                            </div>
                                                            <div className="divide-y divide-border/50">
                                                                {entry.payments.map((p, pIdx) => (
                                                                    <div key={pIdx} className="flex justify-between items-center px-3 py-1.5 text-[11px] hover:bg-muted/20">
                                                                        <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                                                                            {p.payment_method === "EFECTIVO" ? (
                                                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                            ) : (
                                                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                                            )}
                                                                            {p.payment_method}
                                                                            {p.payment_method === 'TARJETA' && (
                                                                                <span className="ml-1 text-[10px] opacity-70">
                                                                                    ({p.terminal_code || 'T.P.V'} • {p.card_type === 'CREDITO' ? 'CRÉD.' : 'DÉB.'} •••• {p.card_last_4})
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                        <span className={`font-mono font-medium ${p.amount < 0 ? 'text-red-500' : ''}`}>
                                                                            {formatCurrency(p.amount)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}

                            {entries.length === 0 && (
                                <tr>
                                    <td colSpan={13} className="p-8 text-center text-muted-foreground">
                                        No hay registros para mostrar
                                    </td>
                                </tr>
                            )}

                            <tr className="border-t-2 border-border font-bold bg-muted print:border-t-2 print:border-black">
                                <td colSpan={8} className="border-r border-border p-3 text-right uppercase print:border-r-2 print:border-black">
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
