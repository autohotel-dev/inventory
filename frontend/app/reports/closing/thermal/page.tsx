"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

interface ShiftClosingData {
    id: string;
    period_start: string;
    period_end: string;
    total_cash: number;
    total_card_bbva: number;
    total_card_getnet: number;
    total_sales: number;
    total_transactions: number;
    total_expenses: number;
    expenses_count: number;
    counted_cash: number;
    cash_difference: number;
    declared_card_bbva?: number;
    declared_card_getnet?: number;
    card_difference_bbva?: number;
    card_difference_getnet?: number;
    notes?: string;
    employees?: { first_name: string; last_name: string };
    shift_definitions?: { name: string };
}

interface RoomStay {
    time: string;
    room: string;
    plate: string;
    total: number;
    method: string;
}

function ThermalReceiptContent() {
    const searchParams = useSearchParams();
    const shiftId = searchParams.get("shiftId");
    const [closing, setClosing] = useState<ShiftClosingData | null>(null);
    const [stays, setStays] = useState<RoomStay[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!shiftId) return;
        const supabase = createClient();

        // Fetch closing data
        const { data: closingData } = await supabase
            .from("shift_closings")
            .select(`
        *,
        employees!shift_closings_employee_id_fkey(first_name, last_name),
        shift_definitions(name)
      `)
            .eq("id", shiftId)
            .single();

        if (closingData) {
            setClosing(closingData);

            // Fetch room stays for this period
            const { data: staysData } = await supabase
                .from("room_stays")
                .select(`
          check_in_at,
          vehicle_plate,
          rooms(number),
          sales_orders(total, payments(payment_method, amount))
        `)
                .gte("check_in_at", closingData.period_start)
                .lte("check_in_at", closingData.period_end)
                .order("check_in_at", { ascending: true });

            if (staysData) {
                const processed = staysData.map((stay: any) => {
                    const payments = stay.sales_orders?.payments || [];
                    let method = "PEND";
                    if (payments.length > 0) {
                        const methods = new Set(payments.map((p: any) => p.payment_method));
                        if (methods.size > 1) {
                            method = "MIX";
                        } else {
                            const m = payments[0].payment_method;
                            method = m === "EFECTIVO" ? "EF" : m === "TARJETA" || m === "TARJETA_BBVA" || m === "TARJETA_GETNET" ? "TJ" : m?.substring(0, 3) || "?";
                        }
                    }
                    return {
                        time: new Date(stay.check_in_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
                        room: stay.rooms?.number || "?",
                        plate: stay.vehicle_plate?.substring(0, 8) || "-",
                        total: stay.sales_orders?.total || 0,
                        method,
                    };
                });
                setStays(processed);
            }
        }

        setLoading(false);
    }, [shiftId]);

    useEffect(() => {
        if (shiftId) {
            fetchData();
        }
    }, [shiftId, fetchData]);

    useEffect(() => {
        if (!loading && closing) {
            // Auto-print after data loads
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [loading, closing]);

    const formatMoney = (amount: number) => `$${amount.toFixed(2)}`;
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" });
    };
    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    };

    if (loading) {
        return <div className="thermal-receipt">Cargando...</div>;
    }

    if (!closing) {
        return <div className="thermal-receipt">No se encontró el corte</div>;
    }

    const employee = closing.employees;
    const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : "N/A";

    return (
        <>
            <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        
        body {
          margin: 0;
          padding: 0;
          background: white;
          font-family: 'Courier New', monospace;
        }
        
        .thermal-receipt {
          width: 72mm;
          max-width: 72mm;
          margin: 0 auto;
          padding: 4mm;
          font-size: 10px;
          line-height: 1.3;
          color: black;
          background: white;
        }
        
        .header {
          text-align: center;
          border-bottom: 1px dashed black;
          padding-bottom: 2mm;
          margin-bottom: 2mm;
        }
        
        .header h1 {
          font-size: 14px;
          font-weight: bold;
          margin: 0 0 2mm 0;
        }
        
        .header p {
          margin: 0;
          font-size: 9px;
        }
        
        .section {
          margin-bottom: 3mm;
        }
        
        .section-title {
          font-weight: bold;
          font-size: 11px;
          border-bottom: 1px solid black;
          margin-bottom: 1mm;
        }
        
        .row {
          display: flex;
          justify-content: space-between;
          padding: 0.5mm 0;
        }
        
        .row.highlight {
          font-weight: bold;
        }
        
        .row.total {
          border-top: 1px dashed black;
          margin-top: 1mm;
          padding-top: 1mm;
          font-weight: bold;
          font-size: 12px;
        }
        
        .row.diff-ok { color: black; }
        .row.diff-over { }
        .row.diff-under { }
        
        .stays-table {
          width: 100%;
          font-size: 9px;
          border-collapse: collapse;
        }
        
        .stays-table th {
          text-align: left;
          border-bottom: 1px solid black;
          padding: 1mm 0;
          font-weight: bold;
        }
        
        .stays-table td {
          padding: 0.5mm 0;
          border-bottom: 1px dotted #ccc;
        }
        
        .stays-table td:last-child {
          text-align: right;
        }
        
        .footer {
          text-align: center;
          border-top: 1px dashed black;
          padding-top: 2mm;
          margin-top: 3mm;
          font-size: 9px;
        }
        
        @media print {
          body { margin: 0; padding: 0; }
          .thermal-receipt { width: 72mm; max-width: 72mm; }
        }
      `}</style>

            <div className="thermal-receipt">
                {/* Header */}
                <div className="header">
                    <h1>CORTE DE CAJA</h1>
                    <p><strong>Auto Hotel Luxor</strong></p>
                    <p>{formatDate(closing.period_start)} | {formatTime(closing.period_start)} - {formatTime(closing.period_end)}</p>
                    <p>Empleado: {employeeName}</p>
                </div>

                {/* Resumen Ventas */}
                <div className="section">
                    <div className="section-title">VENTAS</div>
                    <div className="row">
                        <span>Efectivo:</span>
                        <span>{formatMoney(closing.total_cash)}</span>
                    </div>
                    <div className="row">
                        <span>Tarjeta BBVA:</span>
                        <span>{formatMoney(closing.total_card_bbva)}</span>
                    </div>
                    <div className="row">
                        <span>Tarjeta GETNET:</span>
                        <span>{formatMoney(closing.total_card_getnet)}</span>
                    </div>
                    <div className="row total">
                        <span>TOTAL VENTAS:</span>
                        <span>{formatMoney(closing.total_sales)}</span>
                    </div>
                    <div className="row">
                        <span>Transacciones:</span>
                        <span>{closing.total_transactions}</span>
                    </div>
                </div>

                {/* Gastos */}
                {closing.total_expenses > 0 && (
                    <div className="section">
                        <div className="section-title">GASTOS</div>
                        <div className="row">
                            <span>Total Gastos ({closing.expenses_count}):</span>
                            <span>-{formatMoney(closing.total_expenses)}</span>
                        </div>
                    </div>
                )}

                {/* Arqueo Efectivo */}
                <div className="section">
                    <div className="section-title">ARQUEO EFECTIVO</div>
                    <div className="row">
                        <span>Esperado:</span>
                        <span>{formatMoney(closing.total_cash - (closing.total_expenses || 0))}</span>
                    </div>
                    <div className="row">
                        <span>Contado:</span>
                        <span>{formatMoney(closing.counted_cash)}</span>
                    </div>
                    <div className={`row highlight ${closing.cash_difference === 0 ? 'diff-ok' : closing.cash_difference > 0 ? 'diff-over' : 'diff-under'}`}>
                        <span>Diferencia:</span>
                        <span>{closing.cash_difference >= 0 ? '+' : ''}{formatMoney(closing.cash_difference)}</span>
                    </div>
                </div>

                {/* Arqueo Tarjetas */}
                {(closing.declared_card_bbva !== undefined || closing.declared_card_getnet !== undefined) && (
                    <div className="section">
                        <div className="section-title">ARQUEO TARJETAS</div>
                        {closing.declared_card_bbva !== undefined && (
                            <>
                                <div className="row">
                                    <span>BBVA Declarado:</span>
                                    <span>{formatMoney(closing.declared_card_bbva || 0)}</span>
                                </div>
                                <div className="row">
                                    <span>BBVA Diferencia:</span>
                                    <span>{formatMoney(closing.card_difference_bbva || 0)}</span>
                                </div>
                            </>
                        )}
                        {closing.declared_card_getnet !== undefined && (
                            <>
                                <div className="row">
                                    <span>GETNET Declarado:</span>
                                    <span>{formatMoney(closing.declared_card_getnet || 0)}</span>
                                </div>
                                <div className="row">
                                    <span>GETNET Diferencia:</span>
                                    <span>{formatMoney(closing.card_difference_getnet || 0)}</span>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Detalle de Estancias */}
                {stays.length > 0 && (
                    <div className="section">
                        <div className="section-title">DETALLE ({stays.length})</div>
                        <table className="stays-table">
                            <thead>
                                <tr>
                                    <th>HR</th>
                                    <th>HAB</th>
                                    <th>PLACA</th>
                                    <th>$</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stays.map((stay, idx) => (
                                    <tr key={idx}>
                                        <td>{stay.time}</td>
                                        <td>{stay.room}</td>
                                        <td>{stay.plate}</td>
                                        <td>{formatMoney(stay.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Notas */}
                {closing.notes && (
                    <div className="section">
                        <div className="section-title">NOTAS</div>
                        <p style={{ margin: 0, fontSize: '9px' }}>{closing.notes}</p>
                    </div>
                )}

                {/* Footer */}
                <div className="footer">
                    <p>Impreso: {new Date().toLocaleString("es-MX")}</p>
                    <p>--- FIN DEL CORTE ---</p>
                </div>
            </div>
        </>
    );
}

export default function ThermalClosingReceiptPage() {
    return (
        <Suspense fallback={<div className="thermal-receipt">Cargando...</div>}>
            <ThermalReceiptContent />
        </Suspense>
    );
}
