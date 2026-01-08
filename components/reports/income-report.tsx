"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, ChevronDown, ChevronUp, ChartBar } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/badge";

interface PaymentDetail {
    payment_method: string;
    amount: number;
    card_type?: string;
    card_last_4?: string;
}

interface IncomeEntry {
    no: number;
    time: string;
    vehicle_plate: string;
    room_number: string;
    room_price: number;
    extra: number;
    consumption: number;
    total: number;
    payment_method: string;
    card_type?: string;
    card_last_4?: string;
    stay_status?: string;
    payments?: PaymentDetail[];
}

interface IncomeReportProps {
    reportType: "shift" | "dateRange";
    shiftId?: string;
    startDate?: Date;
    endDate?: Date;
    paymentMethodFilter?: string;
    roomFilter?: string;
    statusFilter?: string;
}

export function IncomeReport({
    reportType,
    shiftId,
    startDate,
    endDate,
    paymentMethodFilter,
    roomFilter,
    statusFilter = "all",
}: IncomeReportProps) {
    const [entries, setEntries] = useState<IncomeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [reportNumber, setReportNumber] = useState("0001");
    const [shiftInfo, setShiftInfo] = useState<any>(null);
    const [expandedRows, setExpandedRows] = useState<number[]>([]);
    const [showStats, setShowStats] = useState(true);

    const toggleRow = (rowNo: number) => {
        setExpandedRows(prev =>
            prev.includes(rowNo)
                ? prev.filter(r => r !== rowNo)
                : [...prev, rowNo]
        );
    };

    useEffect(() => {
        fetchIncomeData();
    }, [reportType, shiftId, startDate, endDate, paymentMethodFilter, roomFilter, statusFilter]);

    const fetchIncomeData = async () => {
        setLoading(true);
        const supabase = createClient();

        try {
            let query = supabase
                .from("room_stays")
                .select(`
          id,
          check_in_at,
          vehicle_plate,
          room_id,
          sales_order_id,
          status,
          rooms!inner (
            number
          ),
          sales_orders!inner (
            id,
            subtotal,
            total,
            paid_amount,
            status,
            payments (
              payment_method,
              card_type,
              card_last_4,
              amount,
              concept
            ),
            sales_order_items (
              concept_type,
              unit_price,
              qty
            )
          )
        `)
                .order("check_in_at", { ascending: true });

            // Filtrar por turno o rango de fechas
            if (reportType === "shift" && shiftId) {
                // Primero intentar buscar en cierres (histórico)
                const { data: closingData, error: closingError } = await supabase
                    .from("shift_closings")
                    .select(`
                        period_start,
                        period_end,
                        employees!shift_closings_employee_id_fkey(first_name, last_name)
                    `)
                    .eq("id", shiftId)
                    .maybeSingle();

                console.log("🔍 Closing data for shift filter:", { shiftId, closingData, closingError });

                let shift: any = null;

                // Mapear a formato esperado
                if (closingData) {
                    const employee = (closingData.employees as any);
                    shift = {
                        shift_start: closingData.period_start,
                        shift_end: closingData.period_end,
                        employee_name: employee ? `${employee.first_name} ${employee.last_name}` : undefined
                    };
                    console.log("📅 Shift period:", { start: shift.shift_start, end: shift.shift_end });
                }

                // Si no es un cierre, buscar en sesiones activas
                if (!shift) {
                    const { data: session, error: sessionError } = await supabase
                        .from("shift_sessions")
                        .select(`
                            clock_in_at,
                            employees!shift_sessions_employee_id_fkey(
                                first_name,
                                last_name
                            )
                        `)
                        .eq("id", shiftId)
                        .single();

                    console.log("🔍 Session data for shift filter:", { shiftId, session, sessionError });

                    if (session) {
                        const employee = (session.employees as any);
                        const employeeName = employee
                            ? `${employee.first_name} ${employee.last_name}`
                            : undefined;

                        shift = {
                            shift_start: session.clock_in_at,
                            shift_end: null, // Turno abierto
                            employee_name: employeeName
                        };
                        console.log("📅 Active shift period:", { start: shift.shift_start, end: "NOW" });
                    }
                }

                if (shift) {
                    setShiftInfo(shift);
                    query = query.gte("check_in_at", shift.shift_start);

                    // Si el turno tiene fin (cerrado), usarlo. Si no (activo), usar ahora.
                    if (shift.shift_end) {
                        query = query.lte("check_in_at", shift.shift_end);
                    } else {
                        // Para turno actual, hasta el momento presente
                        query = query.lte("check_in_at", new Date().toISOString());
                    }
                    console.log("✅ Query filtered by shift period");
                } else {
                    console.warn("⚠️ No shift data found for shiftId:", shiftId);
                }
            } else if (reportType === "dateRange") {
                if (startDate) {
                    query = query.gte("check_in_at", startDate.toISOString());
                }
                if (endDate) {
                    const endOfDay = new Date(endDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    query = query.lte("check_in_at", endOfDay.toISOString());
                }
            }

            // Filtrar por estado de habitación
            if (statusFilter && statusFilter !== "all") {
                query = query.eq("status", statusFilter);
            } else {
                // Si es "all", mostrar ACTIVA y FINALIZADA
                query = query.in("status", ["ACTIVA", "FINALIZADA"]);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching income data:", error);
                return;
            }

            let processedEntries: IncomeEntry[] = (data || []).map((stay: any, index: number) => {
                const order = stay.sales_orders;
                const items = order?.sales_order_items || [];
                const payments = order?.payments || [];

                const roomPrice = items
                    .filter((item: any) => item.concept_type === "ROOM_BASE")
                    .reduce((sum: number, item: any) => sum + (item.unit_price * item.qty), 0);

                const extra = items
                    .filter((item: any) =>
                        ["EXTRA_PERSON", "EXTRA_HOUR", "RENEWAL", "PROMO_4H"].includes(item.concept_type)
                    )
                    .reduce((sum: number, item: any) => sum + (item.unit_price * item.qty), 0);

                const consumption = Math.max(0, (order?.subtotal || 0) - roomPrice - extra);
                const cardPayment = payments.find((p: any) => p.payment_method === "TARJETA");

                // Determinar método de pago
                let paymentMethod = "";
                if (payments.length === 0) {
                    paymentMethod = "PENDIENTE";
                } else if (payments.length > 1) {
                    // Verificar si son métodos distintos
                    const uniqueMethods = new Set(payments.map((p: any) => p.payment_method));
                    paymentMethod = uniqueMethods.size > 1 ? "MIXTO" : payments[0].payment_method;
                } else {
                    paymentMethod = payments[0].payment_method;
                }

                return {
                    no: index + 1,
                    time: stay.check_in_at ? new Date(stay.check_in_at).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false
                    }) : "",
                    vehicle_plate: stay.vehicle_plate || "",
                    room_number: stay.rooms?.number || "",
                    room_price: roomPrice,
                    extra: extra,
                    consumption: consumption,
                    total: order?.total || order?.subtotal || 0,
                    payment_method: paymentMethod,
                    card_type: cardPayment?.card_type,
                    card_last_4: cardPayment?.card_last_4,
                    stay_status: stay.status,
                    payments: payments.map((p: any) => ({
                        payment_method: p.payment_method,
                        amount: p.amount || 0,
                        card_type: p.card_type,
                        card_last_4: p.card_last_4
                    })),
                };
            });

            if (paymentMethodFilter && paymentMethodFilter !== "all") {
                processedEntries = processedEntries.filter(e => e.payment_method === paymentMethodFilter);
            }

            if (roomFilter && roomFilter !== "all") {
                processedEntries = processedEntries.filter(e => e.room_number === roomFilter);
            }

            setEntries(processedEntries);
        } catch (error) {
            console.error("Error processing income data:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotals = () => {
        return entries.reduce(
            (acc: any, entry: any) => ({
                roomPrice: acc.roomPrice + entry.room_price,
                extra: acc.extra + entry.extra,
                consumption: acc.consumption + entry.consumption,
                total: acc.total + entry.total,
            }),
            { roomPrice: 0, extra: 0, consumption: 0, total: 0 }
        );
    };

    const handlePrint = () => {
        // Construir URL para la página de impresión dedicada
        const params = new URLSearchParams();

        if (reportType === "shift" && shiftId) {
            params.append("shiftId", shiftId);
        } else {
            if (startDate) params.append("startDate", startDate.toISOString());
            if (endDate) params.append("endDate", endDate.toISOString());
        }

        // Agregar filtros actuales si es necesario, aunque el reporte impreso suele ser general
        // Si se desea mantener filtros:
        // if (paymentMethodFilter !== "all") params.append("paymentMethod", paymentMethodFilter);
        // if (roomFilter !== "all") params.append("room", roomFilter);

        const printUrl = `/reports/income/print?${params.toString()}`;
        window.open(printUrl, '_blank');
    };

    const handleExport = () => {
        alert("Función de exportación en desarrollo");
    };

    const totals = calculateTotals();

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
            {/* Header */}
            <div className="flex justify-between items-center no-print">
                <div>
                    <h2 className="text-2xl font-bold">Reporte de Ingresos</h2>
                    <p className="text-sm text-muted-foreground">
                        {reportType === "shift" && shiftInfo ? (
                            <>Turno de {shiftInfo.employee_name || "N/A"} - {new Date(shiftInfo.shift_start).toLocaleDateString()}</>
                        ) : (
                            <>Hospedaje y Consumo Público</>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleExport} variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                    </Button>
                    <Button onClick={handlePrint} size="sm">
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir
                    </Button>
                </div>
            </div>

            {/* Estadísticas Colapsables */}
            <div className="space-y-4">
                <div
                    className="flex items-center justify-between p-2 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border border-border"
                    onClick={() => setShowStats(!showStats)}
                >
                    <div className="flex items-center gap-2 px-2">
                        <ChartBar className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">Resumen Estadístico</h3>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        {showStats ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                </div>

                {showStats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        {/* Total Habitaciones */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Habitaciones</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency((totals.roomPrice || 0))}</div>
                            </CardContent>
                        </Card>

                        {/* Total Extras */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Extras</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency((totals.extra || 0))}</div>
                            </CardContent>
                        </Card>

                        {/* Total Consumo */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Consumo</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency((totals.consumption || 0))}</div>
                            </CardContent>
                        </Card>

                        {/* GRAN TOTAL */}
                        <Card className="bg-primary text-primary-foreground">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-primary-foreground/90">Total General</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency((totals.total || 0))}</div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Reporte */}
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
                                                </div>
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
                                                        <Badge variant="outline" className="text-xs">
                                                            {entry.card_type === "CREDITO" ? "CRÉDITO" : entry.card_type === "DEBITO" ? "DÉBITO" : "TARJETA"}
                                                        </Badge>
                                                        {entry.card_last_4 && (
                                                            <span className="text-xs font-mono text-muted-foreground">•••• {entry.card_last_4}</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">{entry.payment_method || "-"}</span>
                                                )}
                                            </td>
                                        </tr>
                                        {/* Fila expandible para detalles de pago mixto */}
                                        {expandedRows.includes(entry.no) && entry.payments && (
                                            <tr className="bg-muted/30 print:hidden animate-in fade-in-0 slide-in-from-top-1">
                                                <td colSpan={8} className="p-0 border-r border-border"></td>
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
                                                                            ({p.card_type === 'CREDITO' ? 'CRÉD.' : 'DÉB.'} •••• {p.card_last_4})
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
                                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                            No hay registros para mostrar
                                        </td>
                                    </tr>
                                )}

                                {/* Fila de totales */}
                                <tr className="border-t-2 border-border font-bold bg-muted print:border-t-2 print:border-black">
                                    <td colSpan={4} className="border-r border-border p-3 text-right uppercase print:border-r-2 print:border-black">
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
                </CardContent>
            </Card>

            <style jsx global>{`
        @media print {
          /* Ocultar elementos que no son para imprimir */
          .no-print {
            display: none !important;
          }
          
          /* Configuración general de la página */
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            margin: 10mm;
            font-size: 10pt;
          }
          
          /* Eliminar todos los colores y fondos */
          * {
            color: black !important;
            background: white !important;
          }
          
          /* Tabla compacta y limpia */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            border: 2px solid black !important;
          }
          
          th, td {
            border: 1px solid black !important;
            padding: 2px 4px !important;
            font-size: 9pt !important;
          }
          
          th {
            font-weight: bold !important;
            text-align: center !important;
          }
          
          /* Bordes más gruesos para secciones importantes */
          .print\\:border-2 {
            border-width: 2px !important;
          }
          
          .print\\:border-b-2 {
            border-bottom-width: 2px !important;
          }
          
          .print\\:border-r-2 {
            border-right-width: 2px !important;
          }
          
          .print\\:border-black {
            border-color: black !important;
          }
          
          /* Altura fija para filas vacías */
          .print\\:h-6 {
            height: 18px !important;
          }
          
          /* Mostrar filas vacías solo en impresión */
          .print\\:table-row {
            display: table-row !important;
          }
          
          /* Ocultar en impresión */
          .print\\:hidden {
            display: none !important;
          }
          
          /* Prevenir saltos de página */
          table {
            page-break-inside: auto;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          
          /* Eliminar sombras */
          .print\\:shadow-none {
            box-shadow: none !important;
          }
        }
      `}</style>
        </div>
    );
}
