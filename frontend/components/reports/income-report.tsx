"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, ChevronDown, ChevronUp, ChartBar, FileText, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PaymentDetail {
    payment_method: string;
    amount: number;
    card_type?: string;
    card_last_4?: string;
    terminal_code?: string;
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
    terminal_code?: string;
    stay_status?: string;
    checkout_valet_name?: string;
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
    const [currentShift, setCurrentShift] = useState<any>(null); // To store "On Duty" info
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
        fetchCurrentShift();
    }, []);

    useEffect(() => {
        fetchIncomeData();
    }, [reportType, shiftId, startDate, endDate, paymentMethodFilter, roomFilter, statusFilter]);

    // Fetch separate info about who is CURRENTLY on duty (for the header/export)
    const fetchCurrentShift = useCallback(async () => {
        const supabase = createClient();
        const { data: sessions } = await supabase
            .from("shift_sessions")
            .select(`
                id,
                status,
                employees!shift_sessions_employee_id_fkey(
                    first_name,
                    last_name
                )
            `)
            .eq("status", "active");

        // Tomar la primera sesión activa (o null si no hay)
        const session = sessions && sessions.length > 0 ? sessions[0] : null;

        if (session) {
            const emp = (session.employees as any);
            setCurrentShift({
                employee_name: emp ? `${emp.first_name} ${emp.last_name}` : "Desconocido"
            });
        }
    }, []);

    const fetchIncomeData = useCallback(async () => {
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
          checkout_valet_employee_id,
          checkout_valet:employees!room_stays_checkout_valet_employee_id_fkey(
            first_name,
            last_name
          ),
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
                id,
                payment_method,
                card_type,
                card_last_4,
                terminal_code,
                amount,
                concept,
                status,
                reference,
                collected_by,
                collected_at,
                shift_session_id
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
    id,
    period_start,
        period_end,
        shift_session_id,
        employees!shift_closings_employee_id_fkey(first_name, last_name)
                    `)
                    .eq("id", shiftId)
                    .maybeSingle();

                console.log("🔍 Closing data for shift filter:", { shiftId, closingData, closingError });

                let shift: any = null;
                let shiftSessionId: string | null = null;

                // Mapear a formato esperado
                if (closingData) {
                    const employee = (closingData.employees as any);
                    shift = {
                        shift_start: closingData.period_start,
                        shift_end: closingData.period_end,
                        employee_name: employee ? `${employee.first_name} ${employee.last_name} ` : undefined
                    };
                    shiftSessionId = closingData.shift_session_id;
                    console.log("📅 Shift period:", { start: shift.shift_start, end: shift.shift_end });
                }

                // Si no es un cierre, buscar en sesiones activas
                if (!shift) {
                    const { data: session, error: sessionError } = await supabase
                        .from("shift_sessions")
                        .select(`
                            id,
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
                            ? `${employee.first_name} ${employee.last_name} `
                            : undefined;

                        shift = {
                            shift_start: session.clock_in_at,
                            shift_end: null, // Turno abierto
                            employee_name: employeeName
                        };
                        shiftSessionId = session.id;
                        console.log("📅 Active shift period:", { start: shift.shift_start, end: "NOW" });
                    }
                }

                if (shift) {
                    setShiftInfo(shift);

                    // Buscar EXCLUSIVAMENTE las ENTRADAS (Check-in) que ocurrieron durante este turno
                    // como solicitó el usuario: "Solo deben de registrarse entradas por es el dinero que ingresa recepcion"
                    query = query.gte("check_in_at", shift.shift_start);
                    if (shift.shift_end) {
                        query = query.lte("check_in_at", shift.shift_end);
                    } else {
                        query = query.lte("check_in_at", new Date().toISOString());
                    }
                    console.log("✅ Query filtered by true check-in time for shift");
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
                // Si es "all", mostrar ACTIVA, FINALIZADA y CANCELADA
                query = query.in("status", ["ACTIVA", "FINALIZADA", "CANCELADA"]);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching income data:", error);
                return;
            }

            // Filtrar habitaciones de prueba (13 y 113)
            const filteredData = (data || []).filter((stay: any) => {
                const roomNum = stay.rooms?.number;
                return roomNum !== '13' && roomNum !== '113' && roomNum !== 'Habitación 13' && roomNum !== 'Habitación 113';
            });

            let processedEntries: IncomeEntry[] = filteredData.map((stay: any, index: number) => {
                const order = stay.sales_orders;
                const items = Array.isArray(order) ? (order[0]?.sales_order_items || []) : (order?.sales_order_items || []);

                // Extraer pagos de forma robusta y de-duplicar por ID (evita problemas de join)
                const rawOrderData = order ? (Array.isArray(order) ? order : [order]) : [];
                const allObservedPayments: any[] = [];
                
                rawOrderData.forEach((o: any) => {
                    if (o?.payments) {
                        const pList = Array.isArray(o.payments) ? o.payments : [o.payments];
                        allObservedPayments.push(...pList);
                    }
                });

                // De-duplicar por ID único PRIMERO
                const idUniquePaymentsMap = new Map();
                allObservedPayments.forEach((p: any) => {
                    if (p.id) idUniquePaymentsMap.set(p.id, p);
                });

                // Aplicar filtros básicos
                const filteredList = Array.from(idUniquePaymentsMap.values()).filter(
                    (p: any) => 
                        p.status !== 'PENDIENTE' && 
                        p.concept?.toUpperCase() !== 'CHECKOUT' &&
                        p.payment_method !== 'PENDIENTE'
                );

                // DE-DUPLICAR POR CONTENIDO (Nuclear Fix for physical duplicates in DB)
                // Si tenemos dos pagos con el mismo monto, método y tarjeta, los colapsamos.
                const contentUniqueMap = new Map();
                filteredList.forEach((p: any) => {
                    const key = `${p.amount}-${p.payment_method}-${p.card_last_4 || 'none'}`;
                    // Preferimos el que tenga un concepto diferente de null si hay colisión
                    if (!contentUniqueMap.has(key) || p.concept) {
                        contentUniqueMap.set(key, p);
                    }
                });

                const payments = Array.from(contentUniqueMap.values());

                
                // Agrupar pagos por shift_session_id (a qué turno pertenecen para el reporte)
                const paymentsByShift = new Map();
                payments.forEach(p => {
                    const shiftId = p.shift_session_id || 'SIN_TURNO';
                    if (!paymentsByShift.has(shiftId)) {
                        paymentsByShift.set(shiftId, []);
                    }
                    paymentsByShift.get(shiftId).push(p);
                });
                
                let roomPrice = 0;
                let extra = 0;
                let consumption = 0;

                if (stay.status === "CANCELADA") {
                    roomPrice = Array.isArray(order) ? (order[0]?.total || 0) : (order?.total || 0);
                    // consumption y extra en 0 para canceladas (solo mostramos lo retenido en precio)
                } else {
                    roomPrice = items
                        .filter((item: any) => item.concept_type === "ROOM_BASE")
                        .reduce((sum: number, item: any) => sum + (item.unit_price * item.qty), 0);

                    extra = items
                        .filter((item: any) =>
                            ["EXTRA_PERSON", "EXTRA_HOUR", "RENEWAL", "PROMO_4H"].includes(item.concept_type)
                        )
                        .reduce((sum: number, item: any) => sum + (item.unit_price * item.qty), 0);

                    consumption = Math.max(0, (Array.isArray(order) ? (order[0]?.subtotal || 0) : (order?.subtotal || 0)) - roomPrice - extra);
                }

                // Determinar método de pago para el badge principal
                let paymentMethodLabel = "";
                if (payments.length === 0) {
                    paymentMethodLabel = "PENDIENTE";
                } else if (payments.length > 1) {
                    const uniqueMethods = new Set(payments.map((p: any) => p.payment_method));
                    paymentMethodLabel = uniqueMethods.size > 1 ? "MIXTO" : payments[0].payment_method;
                } else {
                    paymentMethodLabel = payments[0].payment_method;
                }

                const cardPayment = payments.find((p: any) => p.payment_method === "TARJETA");

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
                    total: (Array.isArray(order) ? (order[0]?.total || 0) : (order?.total || 0)) || (roomPrice + extra + consumption),
                    payment_method: paymentMethodLabel,
                    card_type: cardPayment?.card_type,
                    card_last_4: cardPayment?.card_last_4,
                    terminal_code: cardPayment?.terminal_code,
                    stay_status: stay.status,
                    checkout_valet_name: stay.checkout_valet ? `${stay.checkout_valet.first_name} ${stay.checkout_valet.last_name}`.trim() : "—",
                    payments: payments.map((p: any) => ({
                        payment_method: p.payment_method,
                        amount: p.amount || 0,
                        card_type: p.card_type,
                        card_last_4: p.card_last_4,
                        terminal_code: p.terminal_code
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
    }, [reportType, shiftId, startDate, endDate, paymentMethodFilter, roomFilter, statusFilter]);

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
        const totals = calculateTotals();

        // Info de recepcionista
        let receptionistName = "N/A";
        if (shiftInfo?.employee_name) {
            receptionistName = shiftInfo.employee_name;
        } else if (currentShift?.employee_name) {
            receptionistName = currentShift.employee_name;
        }

        // Periodo del turno
        let periodLabel = "";
        if (reportType === "shift" && shiftInfo) {
            const start = new Date(shiftInfo.shift_start).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
            const end = shiftInfo.shift_end
                ? new Date(shiftInfo.shift_end).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
                : "En curso";
            periodLabel = `${start} — ${end}`;
        } else if (reportType === "dateRange") {
            const s = startDate ? startDate.toLocaleDateString("es-MX") : "Inicio";
            const e = endDate ? endDate.toLocaleDateString("es-MX") : "Fin";
            periodLabel = `${s} — ${e}`;
        }

        // Desglose por método de pago
        const paymentBreakdown: Record<string, number> = {};
        entries.forEach(entry => {
            if (entry.payments && entry.payments.length > 0) {
                entry.payments.forEach(p => {
                    const key = p.payment_method === "TARJETA"
                        ? `TARJETA ${p.terminal_code || ""} ${p.card_type || ""}`.trim()
                        : p.payment_method;
                    paymentBreakdown[key] = (paymentBreakdown[key] || 0) + p.amount;
                });
            } else if (entry.payment_method && entry.payment_method !== "PENDIENTE") {
                paymentBreakdown[entry.payment_method] = (paymentBreakdown[entry.payment_method] || 0) + entry.total;
            }
        });

        const tableRows = entries.map((e, idx) => {
            let payDetail = "";
            if (e.payment_method === "MIXTO" && e.payments) {
                payDetail = e.payments.map(p =>
                    `${p.payment_method}${p.payment_method === "TARJETA" ? ` (${p.terminal_code || "TPV"} ${p.card_type === "CREDITO" ? "CRÉD" : "DÉB"} ****${p.card_last_4 || ""})` : ""}: $${Number(p.amount).toFixed(2)}`
                ).join(" | ");
            } else if (e.payment_method === "TARJETA") {
                payDetail = `${e.terminal_code || "TPV"} ${e.card_type === "CREDITO" ? "CRÉD" : "DÉB"} ****${e.card_last_4 || ""}`;
            } else {
                payDetail = e.payment_method;
            }

            return `<tr style="${idx % 2 === 0 ? "" : "background:#f9fafb;"}">
                <td style="text-align:center;font-weight:600;">${e.no}</td>
                <td style="text-align:center;">${e.time}</td>
                <td style="text-align:center;text-transform:uppercase;font-size:10px;">${e.vehicle_plate || "—"}</td>
                <td style="text-align:center;font-weight:600;">${e.room_number}${e.stay_status === "CANCELADA" ? ' <span style="color:#dc2626;font-size:9px;">(CANC)</span>' : e.stay_status === "ACTIVA" ? ' <span style="color:#d97706;font-size:9px;">(ACT)</span>' : ""}</td>
                <td style="text-align:center;font-size:10px;color:#4b5563;">${e.checkout_valet_name || "—"}</td>
                <td style="text-align:right;font-family:monospace;">$${Number(e.room_price).toFixed(2)}</td>
                <td style="text-align:right;font-family:monospace;">${e.extra > 0 ? "$" + Number(e.extra).toFixed(2) : "—"}</td>
                <td style="text-align:right;font-family:monospace;">${e.consumption > 0 ? "$" + Number(e.consumption).toFixed(2) : "—"}</td>
                <td style="text-align:right;font-weight:700;font-family:monospace;">$${Number(e.total).toFixed(2)}</td>
                <td style="text-align:center;font-size:10px;">${payDetail}</td>
            </tr>`;
        }).join("");

        const breakdownRows = Object.entries(paymentBreakdown).map(([method, amount]) =>
            `<tr><td style="padding:4px 12px;font-size:11px;border-bottom:1px solid #e5e7eb;">${method}</td><td style="padding:4px 12px;text-align:right;font-weight:600;font-family:monospace;border-bottom:1px solid #e5e7eb;">$${Number(amount).toFixed(2)}</td></tr>`
        ).join("");

        const printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Corte de Caja — Luxor Auto Hotel</title>
    <style>
        @page { size: portrait; margin: 8mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 11px; color: #111; background: #fff; }
        .header { text-align: center; border-bottom: 3px double #111; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 2px; }
        .header h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #444; margin-bottom: 8px; }
        .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #111; color: #fff; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; border: 1px solid #111; }
        td { padding: 5px 8px; border: 1px solid #d1d5db; font-size: 11px; }
        .totals-row td { background: #f3f4f6; font-weight: 700; border-top: 2px solid #111; }
        .footer { display: flex; justify-content: space-between; margin-top: 20px; gap: 20px; }
        .footer-box { flex: 1; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; }
        .footer-box h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #666; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .signature { margin-top: 40px; display: flex; justify-content: space-around; }
        .sig-line { text-align: center; width: 200px; }
        .sig-line .line { border-top: 1px solid #111; margin-bottom: 4px; }
        .sig-line span { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
    </style>
</head>
<body onload="setTimeout(()=>window.print(),300)">
    <div class="header">
        <h1>Luxor Auto Hotel</h1>
        <h2>Corte de Caja</h2>
        <div class="meta">
            <span><b>Recepcionista:</b> ${receptionistName}</span>
            <span><b>Periodo:</b> ${periodLabel}</span>
            <span><b>Impreso:</b> ${new Date().toLocaleString("es-MX")}</span>
            <span><b>Registros:</b> ${entries.length}</span>
        </div>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width:35px">No.</th>
                <th style="width:55px">Hora</th>
                <th style="width:80px">Placas</th>
                <th style="width:50px">Hab.</th>
                <th style="width:60px">Aprobó</th>
                <th style="width:75px">Precio</th>
                <th style="width:70px">Extra</th>
                <th style="width:75px">Consumo</th>
                <th style="width:80px">Total</th>
                <th>Forma de Pago</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
            <tr class="totals-row">
                <td colspan="4" style="text-align:right;text-transform:uppercase;letter-spacing:2px;font-size:10px;">Suma Total</td>
                <td style="text-align:right;font-family:monospace;">$${Number(totals.roomPrice).toFixed(2)}</td>
                <td style="text-align:right;font-family:monospace;">$${Number(totals.extra).toFixed(2)}</td>
                <td style="text-align:right;font-family:monospace;">$${Number(totals.consumption).toFixed(2)}</td>
                <td style="text-align:right;font-family:monospace;font-size:13px;">$${Number(totals.total).toFixed(2)}</td>
                <td></td>
            </tr>
        </tbody>
    </table>
    <div class="footer">
        <div class="footer-box">
            <h4>Desglose por Método de Pago</h4>
            <table style="margin:0;"><tbody>${breakdownRows}</tbody></table>
        </div>
        <div class="footer-box">
            <h4>Resumen</h4>
            <table style="margin:0;"><tbody>
                <tr><td style="padding:4px 12px;font-size:11px;border-bottom:1px solid #e5e7eb;">Habitaciones</td><td style="padding:4px 12px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e5e7eb;">$${Number(totals.roomPrice).toFixed(2)}</td></tr>
                <tr><td style="padding:4px 12px;font-size:11px;border-bottom:1px solid #e5e7eb;">Extras</td><td style="padding:4px 12px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e5e7eb;">$${Number(totals.extra).toFixed(2)}</td></tr>
                <tr><td style="padding:4px 12px;font-size:11px;border-bottom:1px solid #e5e7eb;">Consumo</td><td style="padding:4px 12px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e5e7eb;">$${Number(totals.consumption).toFixed(2)}</td></tr>
                <tr><td style="padding:4px 12px;font-size:12px;font-weight:700;border-top:2px solid #111;">TOTAL</td><td style="padding:4px 12px;text-align:right;font-family:monospace;font-weight:700;font-size:14px;border-top:2px solid #111;">$${Number(totals.total).toFixed(2)}</td></tr>
            </tbody></table>
        </div>
    </div>
    <div class="signature">
        <div class="sig-line"><div class="line"></div><span>Recepcionista</span></div>
        <div class="sig-line"><div class="line"></div><span>Supervisor / Gerente</span></div>
    </div>
</body>
</html>`;

        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write(printHtml);
            printWindow.document.close();
        }
    };

    const handlePrintHP = async () => {
        let receptionistName = "N/A";
        if (shiftInfo?.employee_name) {
            receptionistName = shiftInfo.employee_name;
        } else if (currentShift?.employee_name) {
            receptionistName = currentShift.employee_name;
        }

        // Payment breakdown for the summary section
        const paymentBreakdown: Record<string, number> = {};
        entries.forEach(entry => {
            if (entry.payments && entry.payments.length > 0) {
                entry.payments.forEach(p => {
                    const key = p.payment_method === "TARJETA"
                        ? `TARJETA ${p.terminal_code || ""} ${p.card_type || ""}`.trim()
                        : p.payment_method;
                    paymentBreakdown[key] = (paymentBreakdown[key] || 0) + p.amount;
                });
            } else if (entry.payment_method && entry.payment_method !== "PENDIENTE") {
                paymentBreakdown[entry.payment_method] = (paymentBreakdown[entry.payment_method] || 0) + entry.total;
            }
        });

        const printData = {
            employeeName: receptionistName,
            periodStart: shiftInfo?.shift_start || startDate?.toISOString() || new Date().toISOString(),
            periodEnd: shiftInfo?.shift_end || endDate?.toISOString() || new Date().toISOString(),
            paymentBreakdown,
            entries: entries.map(e => ({
                time: e.time,
                vehicle_plate: e.vehicle_plate,
                room_number: e.room_number,
                checkout_valet_name: e.checkout_valet_name,
                room_price: e.room_price,
                extra: e.extra,
                consumption: e.consumption,
                total: e.total,
                payment_method: e.payment_method,
            })),
        };

        try {
            const PRINT_SERVER_URL = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';
            const response = await fetch(`${PRINT_SERVER_URL}/print/hp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'income', data: printData }),
            });
            if (!response.ok) {
                console.error('HP print error:', await response.json());
            }
        } catch (error) {
            console.error('Error printing to HP:', error);
        }
    };

    const handleExport = () => {
        const totals = calculateTotals();

        let receptionistName = "N/A";
        if (shiftInfo?.employee_name) {
            receptionistName = shiftInfo.employee_name;
        } else if (currentShift?.employee_name) {
            receptionistName = `${currentShift.employee_name} (En Turno)`;
        }

        let periodLabel = "General";
        if (reportType === "shift" && shiftInfo) {
            periodLabel = `Turno: ${new Date(shiftInfo.shift_start).toLocaleString("es-MX")} - ${shiftInfo.shift_end ? new Date(shiftInfo.shift_end).toLocaleString("es-MX") : "En curso"}`;
        } else if (reportType === "dateRange") {
            const s = startDate ? startDate.toLocaleDateString("es-MX") : "Inicio";
            const e = endDate ? endDate.toLocaleDateString("es-MX") : "Fin";
            periodLabel = `Rango: ${s} - ${e}`;
        }

        // Header rows
        const lines: string[] = [];
        lines.push(`"CORTE DE CAJA — LUXOR AUTO HOTEL"`);
        lines.push(`"Recepcionista:","${receptionistName}","Periodo:","${periodLabel}","Exportado:","${new Date().toLocaleString("es-MX")}"`);
        lines.push(""); // blank separator

        // Column headers
        lines.push(["No.", "Horario", "Placas", "Habitación", "Aprobó Salida", "Estado", "Precio Hab.", "Extras", "Consumo", "Total", "Forma Pago", "Detalle Pago"].map(h => `"${h}"`).join(","));

        // Data rows
        entries.forEach(e => {
            let payDetail = "";
            if (e.payment_method === "MIXTO" && e.payments) {
                payDetail = e.payments.map(p =>
                    `${p.payment_method}${p.payment_method === "TARJETA" ? ` (${p.terminal_code || "TPV"} ${p.card_type === "CREDITO" ? "CRÉD" : "DÉB"} ****${p.card_last_4 || ""})` : ""}: $${Number(p.amount).toFixed(2)}`
                ).join(" | ");
            } else if (e.payment_method === "TARJETA") {
                payDetail = `${e.terminal_code || "TPV"} ${e.card_type === "CREDITO" ? "CRÉD" : "DÉB"} ****${e.card_last_4 || ""}`;
            } else {
                payDetail = e.payment_method;
            }

            lines.push([
                e.no,
                e.time,
                e.vehicle_plate,
                e.room_number,
                e.checkout_valet_name || "—",
                e.stay_status || "",
                e.room_price.toFixed(2),
                e.extra.toFixed(2),
                e.consumption.toFixed(2),
                e.total.toFixed(2),
                e.payment_method,
                payDetail
            ].map(val => `"${val}"`).join(","));
        });

        // Totals row
        lines.push("");
        lines.push(["", "", "", "", "", "TOTALES:", totals.roomPrice.toFixed(2), totals.extra.toFixed(2), totals.consumption.toFixed(2), totals.total.toFixed(2), "", ""].map(v => `"${v}"`).join(","));

        // Payment breakdown
        const paymentBreakdown: Record<string, number> = {};
        entries.forEach(entry => {
            if (entry.payments && entry.payments.length > 0) {
                entry.payments.forEach(p => {
                    const key = p.payment_method === "TARJETA"
                        ? `TARJETA ${p.terminal_code || ""} ${p.card_type || ""}`.trim()
                        : p.payment_method;
                    paymentBreakdown[key] = (paymentBreakdown[key] || 0) + p.amount;
                });
            } else if (entry.payment_method && entry.payment_method !== "PENDIENTE") {
                paymentBreakdown[entry.payment_method] = (paymentBreakdown[entry.payment_method] || 0) + entry.total;
            }
        });

        lines.push("");
        lines.push(`"DESGLOSE POR MÉTODO DE PAGO"`);
        Object.entries(paymentBreakdown).forEach(([method, amount]) => {
            lines.push(`"${method}","$${Number(amount).toFixed(2)}"`);
        });

        // BOM + content for proper UTF-8 in Excel
        const BOM = "\uFEFF";
        const csvContent = BOM + lines.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const dateStr = new Date().toISOString().split("T")[0];
        link.setAttribute("download", `corte_caja_luxor_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
                    <h2 className="text-2xl font-bold">Corte de Caja</h2>
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm">
                                <Printer className="h-4 w-4 mr-2" />
                                Imprimir
                                <ChevronDown className="h-3 w-3 ml-1.5 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={handlePrintHP} className="cursor-pointer">
                                <FileText className="h-4 w-4 mr-2 text-blue-500" />
                                Hoja HP (directo)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handlePrint} className="cursor-pointer">
                                <Receipt className="h-4 w-4 mr-2 text-orange-500" />
                                Vista previa (navegador)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Estadísticas Colapsables */}
            <div className="space-y-4 no-print">
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
                        <div className="bg-card p-6 rounded-xl border border-blue-200/50 dark:border-blue-900/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                                    <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
                                </svg>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-semibold text-muted-foreground">Habitaciones</span>
                                </div>
                                <div className="text-2xl font-bold text-foreground">
                                    {formatCurrency((totals.roomPrice || 0))}
                                </div>
                            </div>
                        </div>

                        {/* Total Extras */}
                        <div className="bg-card p-6 rounded-xl border border-purple-200/50 dark:border-purple-900/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
                                    <path d="M12 2v20" />
                                    <path d="M2 12h20" />
                                </svg>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 8v4" />
                                            <path d="M12 16h.01" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-semibold text-muted-foreground">Extras</span>
                                </div>
                                <div className="text-2xl font-bold text-foreground">
                                    {formatCurrency((totals.extra || 0))}
                                </div>
                            </div>
                        </div>

                        {/* Total Consumo */}
                        <div className="bg-card p-6 rounded-xl border border-amber-200/50 dark:border-amber-900/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                                    <path d="M6 13.87A8 8 0 1 1 6 10a8 8 0 0 1 0 3.87" />
                                    <path d="M14.54 2.11a2.97 2.97 0 0 0-5.08 0" />
                                </svg>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M16 12h-4" />
                                            <path d="M12 8v8" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-semibold text-muted-foreground">Consumo</span>
                                </div>
                                <div className="text-2xl font-bold text-foreground">
                                    {formatCurrency((totals.consumption || 0))}
                                </div>
                            </div>
                        </div>

                        {/* GRAN TOTAL */}
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-shadow text-white">
                            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                    <line x1="12" x2="12" y1="2" y2="22" />
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                </svg>
                            </div>
                            <div className="flex flex-col gap-1 relative z-10">
                                <div className="flex items-center gap-2 mb-2 opacity-90">
                                    <div className="p-2 rounded-lg bg-white/20 text-white">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" x2="12" y1="1" y2="23" />
                                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium">TOTAL GENERAL</span>
                                </div>
                                <div className="text-3xl font-bold">
                                    {formatCurrency((totals.total || 0))}
                                </div>
                                <p className="text-xs opacity-75 mt-1">Ingresos brutos</p>
                            </div>
                        </div>
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
                                        <tr className={`border - b border - border hover: bg - muted / 30 transition - colors print: border - b print: border - black ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'} `}>
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
                                            <td className="border-r border-border p-2 text-center text-[10px] text-muted-foreground print:border-r print:border-black">
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
                                                <td colSpan={9} className="p-0 border-r border-border"></td>
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
                                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                            No hay registros para mostrar
                                        </td>
                                    </tr>
                                )}

                                {/* Fila de totales */}
                                <tr className="border-t-2 border-border font-bold bg-muted print:border-t-2 print:border-black">
                                    <td colSpan={5} className="border-r border-border p-3 text-right uppercase print:border-r-2 print:border-black">
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
        </div>
    );
}
