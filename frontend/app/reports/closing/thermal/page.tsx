"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

interface ShiftClosingData {
    id: string;
    shift_session_id?: string;
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
    items?: AdditionalItem[];
}

interface AdditionalItem {
    description: string;
    quantity: number;
    total: number;
    type: string;
}

interface DamageDetailItem {
    id: string;
    time: string;
    room_number: string;
    reason: string;
    amount: number;
}

interface ShiftExpense {
    id: string;
    description: string;
    amount: number;
    expense_type: string;
    created_at: string;
}

interface EmployeeChargeItem {
    id: string;
    charge_type: string;
    description: string;
    total: number;
    discount_amount: number;
    payment_method: string;
    created_at: string;
    charged_employee?: { first_name: string; last_name: string } | null;
}

function ThermalReceiptContent() {
    const searchParams = useSearchParams();
    const shiftId = searchParams.get("shiftId");
    const [closing, setClosing] = useState<ShiftClosingData | null>(null);
    const [stays, setStays] = useState<RoomStay[]>([]);
    const [expenses, setExpenses] = useState<ShiftExpense[]>([]);
    const [damages, setDamages] = useState<DamageDetailItem[]>([]);
    const [employeeCharges, setEmployeeCharges] = useState<EmployeeChargeItem[]>([]);
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

            // Fetch expenses
            const { data: expensesData } = await supabase
                .from("shift_expenses")
                .select("id, description, amount, expense_type, created_at")
                .eq("shift_session_id", closingData.shift_session_id || shiftId)
                .neq("status", "rejected")
                .order("created_at", { ascending: true });
            setExpenses(expensesData || []);

            // Fetch employee charges
            const { data: chargesData } = await supabase
                .from("shift_employee_charges")
                .select(`
                    id, charge_type, description, total, discount_amount,
                    payment_method, created_at,
                    charged_employee:charged_to(first_name, last_name)
                `)
                .eq("shift_session_id", closingData.shift_session_id || shiftId)
                .neq("status", "rejected")
                .order("created_at", { ascending: true });
            setEmployeeCharges((chargesData || []) as EmployeeChargeItem[]);

            // Fetch damages for this shift session, excluding room 13/113
            const { data: damagesData } = await supabase
                .from("sales_order_items")
                .select(`
                    id, qty, unit_price, total, courtesy_reason, created_at, is_cancelled,
                    sales_orders(
                        room_stays(
                            rooms(number)
                        )
                    )
                `)
                .eq("shift_session_id", closingData.shift_session_id || shiftId)
                .eq("concept_type", "DAMAGE_CHARGE");

            if (damagesData) {
                const activeDamages = damagesData.filter((dmg: any) => {
                    if (dmg.is_cancelled) return false;
                    const order = dmg.sales_orders;
                    const roomStay = Array.isArray(order) ? order[0]?.room_stays : order?.room_stays;
                    const room = Array.isArray(roomStay) ? roomStay[0]?.rooms : roomStay?.rooms;
                    const roomNumber = (Array.isArray(room) ? room[0]?.number : room?.number) || "";
                    return roomNumber !== "13" && roomNumber !== "113";
                });

                const mappedDamages = activeDamages.map((dmg: any) => {
                    const order = dmg.sales_orders;
                    const roomStay = Array.isArray(order) ? order[0]?.room_stays : order?.room_stays;
                    const room = Array.isArray(roomStay) ? roomStay[0]?.rooms : roomStay?.rooms;
                    const roomNumber = (Array.isArray(room) ? room[0]?.number : room?.number) || "—";
                    return {
                        id: dmg.id,
                        time: new Date(dmg.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
                        room_number: roomNumber,
                        reason: dmg.courtesy_reason || "Cargo por Daño",
                        amount: dmg.total || (dmg.qty * dmg.unit_price) || 0
                    };
                });
                setDamages(mappedDamages);
            }

            // Fetch sales orders for this shift session, excluding room 13 and 113
            const { data: salesOrdersData } = await supabase
                .from("sales_orders")
                .select(`
                    id, total, created_at, status, shift_session_id,
                    room_stays(
                        id, check_in_at, vehicle_plate, status,
                        rooms(number)
                    ),
                    payments(payment_method, amount, terminal_code, status, concept),
                    sales_order_items(concept_type, qty, unit_price, total, is_courtesy, courtesy_reason, is_cancelled, products(name))
                `)
                .eq("shift_session_id", closingData.shift_session_id || shiftId);

            if (salesOrdersData) {
                // Filter out cancelled orders and orders for rooms 13/113
                const activeOrders = salesOrdersData.filter((order: any) => {
                    if (order.status === "CANCELLED") return false;
                    const roomStay = Array.isArray(order.room_stays) ? order.room_stays[0] : order.room_stays;
                    if (roomStay) {
                        if (roomStay.status === "CANCELADA") return false;
                        const roomNumber = roomStay.rooms?.number;
                        if (roomNumber === "13" || roomNumber === "113") return false;
                    }
                    return true;
                });

                const processed = activeOrders.map((order: any) => {
                    const payments = order.payments?.filter((p: any) => p.status !== "PENDIENTE" && p.status !== "CANCELADO") || [];
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

                    const items = order.sales_order_items || [];
                    const roomStay = Array.isArray(order.room_stays) ? order.room_stays[0] : order.room_stays;
                    const stayItems: AdditionalItem[] = [];

                    items.forEach((item: any) => {
                        if (!item.is_cancelled && (roomStay ? (item.concept_type !== 'ROOM_BASE' && item.concept_type !== 'VEHICLE_REQUEST') : true)) {
                            let itemName = item.products?.name;
                            if (!itemName) {
                                switch (item.concept_type) {
                                    case 'EXTRA_PERSON': itemName = 'Persona Extra'; break;
                                    case 'EXTRA_HOUR': itemName = 'Hora Extra'; break;
                                    case 'DAMAGE_CHARGE': itemName = 'Cobro Daños'; break;
                                    case 'LATE_CHECKOUT': itemName = 'Salida Tarde'; break;
                                    default: itemName = item.concept_type || 'Extra';
                                }
                            }
                            
                            let description = itemName;
                            if (item.is_courtesy) {
                                description = `${itemName} (${item.courtesy_reason || "Cortesía"})`;
                            } else if (item.concept_type === "DAMAGE_CHARGE" && item.courtesy_reason) {
                                description = `${itemName}: ${item.courtesy_reason}`;
                            }

                            stayItems.push({
                                description,
                                quantity: item.qty || 1, 
                                total: item.is_courtesy ? 0 : (item.total || (item.qty * item.unit_price) || 0),
                                type: item.concept_type 
                            });
                        }
                    });

                    const time = roomStay?.check_in_at ? roomStay.check_in_at : order.created_at;
                    const roomNumber = roomStay?.rooms?.number || "VENTA";
                    const vehiclePlate = roomStay?.vehicle_plate || "—";

                    return {
                        time: new Date(time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
                        room: roomNumber,
                        plate: vehiclePlate.substring(0, 8),
                        total: order.total || 0,
                        method,
                        items: stayItems
                    };
                });

                // Sort by time ascending
                processed.sort((a: RoomStay, b: RoomStay) => a.time.localeCompare(b.time));
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

    // Auto-print after load
    useEffect(() => {
        if (!loading && closing) {
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [loading, closing]);

    const totalEmployeeCharges = employeeCharges.reduce((sum, c) => sum + Number(c.total), 0);
    const totalEmployeeChargesCash = employeeCharges
        .filter(c => c.payment_method === 'CASH')
        .reduce((sum, c) => sum + Number(c.total), 0);

    const CHARGE_TYPE_LABELS: Record<string, string> = {
        BREAKFAST: 'Desayuno', LUNCH: 'Comida', CONSUMPTION: 'Consumo',
        PRODUCT: 'Producto', OTHER: 'Otro',
    };
    const CHARGE_PAYMENT_LABELS: Record<string, string> = {
        CASH: 'Efectivo', DEDUCCION_NOMINA: 'Desc.Nóm', COURTESY: 'Cortesía',
    };

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
    const totalDamages = damages.reduce((sum, dmg) => sum + dmg.amount, 0);

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
          border-collapse: separate;
          border-spacing: 0;
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
          vertical-align: top;
        }
        
        .stays-table tr.stay-row td {
            font-weight: bold;
        }
        
        .stays-table tr.item-row td {
            border-bottom: none;
            padding-top: 0;
            padding-bottom: 0.5mm;
            color: #333;
            font-size: 8px;
        }

        .item-bullet {
            padding-left: 2mm;
            color: #666;
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
                    {totalDamages > 0 && (
                        <div className="row">
                            <span>Total Daños:</span>
                            <span>{formatMoney(totalDamages)}</span>
                        </div>
                    )}
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
                {closing.total_expenses !== 0 && (
                    <div className="section">
                        <div className="section-title">GASTOS Y AJUSTES</div>
                        <div className="row">
                            <span>Total ({closing.expenses_count}):</span>
                            <span>
                                {closing.total_expenses > 0 ? "-" : "+"}
                                {formatMoney(Math.abs(closing.total_expenses))}
                            </span>
                        </div>
                    </div>
                )}

                {/* Arqueo Efectivo */}
                <div className="section">
                    <div className="section-title">ARQUEO EFECTIVO</div>
                    <div className="row">
                        <span>Esperado:</span>
                        <span>{formatMoney(closing.total_cash - (closing.total_expenses || 0) + totalEmployeeChargesCash)}</span>
                    </div>
                    <div className="row">
                        <span>Contado:</span>
                        <span>{formatMoney(closing.counted_cash)}</span>
                    </div>
                    <div className={`row highlight ${closing.cash_difference === 0 ? 'diff-ok' : closing.cash_difference > 0 ? 'diff-over' : 'diff-under'}`}>
                        <span>Diferencia:</span>
                        <span>{closing.cash_difference >= 0 ? '+' : '-'}{formatMoney(Math.abs(closing.cash_difference))}</span>
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

                {/* Detalle de Daños */}
                {damages.length > 0 && (
                    <div className="section">
                        <div className="section-title">DETALLE DE DAÑOS</div>
                        {damages.map((dmg) => (
                            <div key={dmg.id} className="row" style={{ fontSize: '9px' }}>
                                <span>{dmg.time} Hab {dmg.room_number}: {dmg.reason}</span>
                                <span>{formatMoney(dmg.amount)}</span>
                            </div>
                        ))}
                        <div className="row total">
                            <span>TOTAL DAÑOS:</span>
                            <span>{formatMoney(totalDamages)}</span>
                        </div>
                    </div>
                )}

                {/* Detalle de Estancias */}
                {stays.length > 0 && (
                    <div className="section">
                        <div className="section-title">DETALLE ESTANCIAS ({stays.length})</div>
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
                                    <React.Fragment key={idx}>
                                        <tr className="stay-row" style={stay.items && stay.items.length > 0 ? { borderBottom: 'none' } : {}}>
                                            <td style={stay.items && stay.items.length > 0 ? { borderBottom: 'none' } : {}}>{stay.time}</td>
                                            <td style={stay.items && stay.items.length > 0 ? { borderBottom: 'none' } : {}}>{stay.room}</td>
                                            <td style={stay.items && stay.items.length > 0 ? { borderBottom: 'none', fontSize: '8px' } : { fontSize: '8px' }}>{stay.plate}</td>
                                            <td style={stay.items && stay.items.length > 0 ? { borderBottom: 'none' } : {}}>{formatMoney(stay.total)}</td>
                                        </tr>
                                        {stay.items && stay.items.length > 0 && (
                                            <>
                                                <tr className="item-row">
                                                    <td></td>
                                                    <td colSpan={2} style={{ paddingLeft: '2mm', fontSize: '8px', color: '#666' }}>• Renta de Habitación</td>
                                                    <td style={{ fontSize: '8px', color: '#666' }}>{formatMoney(stay.total - stay.items.reduce((sum, i) => sum + i.total, 0))}</td>
                                                </tr>
                                                {stay.items.map((item, idxi) => (
                                                    <tr key={`item-${idx}-${idxi}`} className="item-row">
                                                        <td></td>
                                                        <td colSpan={2} style={{ paddingLeft: '2mm', fontSize: '8px', color: '#666' }}>
                                                            • {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.description}
                                                        </td>
                                                        <td style={{ fontSize: '8px', color: '#666' }}>{formatMoney(item.total)}</td>
                                                    </tr>
                                                ))}
                                                <tr><td colSpan={4} style={{ borderBottom: '1px dotted #ccc', height: '1mm', padding: 0 }}></td></tr>
                                            </>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Detalle de Gastos */}
                {expenses.length > 0 && (
                    <div className="section">
                        <div className="section-title">DETALLE DE GASTOS</div>
                        {expenses.map((exp) => {
                            const isAdjustment = exp.expense_type === "CASH_ADJUSTMENT";
                            const isNegative = Number(exp.amount) < 0;
                            const sign = isNegative ? "+" : "-";
                            const displayAmount = Math.abs(Number(exp.amount));
                            return (
                                <div key={exp.id} className="row" style={{ fontSize: '9px' }}>
                                    <span>{formatTime(exp.created_at)} {isAdjustment ? "[AJUSTE] " : ""}{exp.description}</span>
                                    <span>{sign}{formatMoney(displayAmount)}</span>
                                </div>
                            );
                        })}
                        <div className="row total">
                            <span>TOTAL GASTOS:</span>
                            <span>
                                {closing.total_expenses > 0 ? "-" : closing.total_expenses < 0 ? "+" : ""}
                                {formatMoney(Math.abs(closing.total_expenses))}
                            </span>
                        </div>
                    </div>
                )}

                {/* Notas */}
                {closing.notes && (
                    <div className="section">
                        <div className="section-title">NOTAS</div>
                        <p style={{ margin: 0, fontSize: '9px' }}>{closing.notes}</p>
                    </div>
                )}

                {/* Cargos a Empleados */}
                {employeeCharges.length > 0 && (
                    <div className="section">
                        <div className="section-title">CARGOS A EMPLEADOS</div>
                        {employeeCharges.map((charge) => {
                            const empName = charge.charged_employee
                                ? `${charge.charged_employee.first_name} ${charge.charged_employee.last_name}`
                                : '—';
                            return (
                                <div key={charge.id} className="row" style={{ fontSize: '9px' }}>
                                    <span>
                                        {formatTime(charge.created_at)}{' '}
                                        {CHARGE_TYPE_LABELS[charge.charge_type] || charge.charge_type}:{' '}
                                        {empName}
                                    </span>
                                    <span>
                                        {Number(charge.total) === 0
                                            ? 'CORT'
                                            : formatMoney(Number(charge.total))}
                                    </span>
                                </div>
                            );
                        })}
                        <div className="row total">
                            <span>TOTAL CARGOS:</span>
                            <span>{formatMoney(totalEmployeeCharges)}</span>
                        </div>
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
