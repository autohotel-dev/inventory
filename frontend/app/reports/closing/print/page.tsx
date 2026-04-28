"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────

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
    items?: AdditionalItem[];
}

interface AdditionalItem {
    description: string;
    quantity: number;
    total: number;
    type: string;
}

interface ShiftExpense {
    id: string;
    description: string;
    amount: number;
    expense_type: string;
    created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const formatMoney = (amount: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("es-MX", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });

const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

const CONCEPT_LABELS: Record<string, string> = {
    ROOM_BASE: "Renta de Habitación", EXTRA_HOUR: "Hora Extra", EXTRA_PERSON: "Persona Extra",
    CONSUMPTION: "Consumo", PRODUCT: "Producto", RENEWAL: "Renovación", PROMO_4H: "Promo 4H",
    DAMAGE_CHARGE: "Cobro por Daños", LATE_CHECKOUT: "Salida Tarde",
    ROOM_CHANGE_ADJUSTMENT: "Ajuste Cambio de Habitación",
};

// ─── Main Content ────────────────────────────────────────────────────

function PrintClosingContent() {
    const searchParams = useSearchParams();
    const shiftId = searchParams.get("shiftId");
    const [closing, setClosing] = useState<ShiftClosingData | null>(null);
    const [stays, setStays] = useState<RoomStay[]>([]);
    const [expenses, setExpenses] = useState<ShiftExpense[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!shiftId) return;
        const supabase = createClient();

        // Fetch closing data
        const { data: closingData } = await supabase
            .from("shift_closings")
            .select(`*, employees!shift_closings_employee_id_fkey(first_name, last_name), shift_definitions(name)`)
            .eq("id", shiftId)
            .single();

        if (!closingData) { setLoading(false); return; }
        setClosing(closingData);

        // Fetch expenses
        const { data: expensesData } = await supabase
            .from("shift_expenses")
            .select("*")
            .eq("shift_session_id", closingData.shift_session_id || shiftId)
            .neq("status", "rejected")
            .order("created_at", { ascending: true });
        setExpenses(expensesData || []);

        // Fetch room stays
        const { data: staysData } = await supabase
            .from("room_stays")
            .select(`
                check_in_at, vehicle_plate,
                rooms(number),
                sales_orders(
                    total,
                    payments(payment_method, amount, terminal_code),
                    sales_order_items(concept_type, qty, unit_price, total, products(name))
                )
            `)
            .gte("check_in_at", closingData.period_start)
            .lte("check_in_at", closingData.period_end)
            .order("check_in_at", { ascending: true });

        if (staysData) {
            const processed = staysData.map((stay: any) => {
                const payments = stay.sales_orders?.payments || [];
                let method = "PENDIENTE";
                if (payments.length > 0) {
                    const methods = new Set(payments.map((p: any) => p.payment_method));
                    if (methods.size > 1) method = "MIXTO";
                    else {
                        const m = payments[0].payment_method;
                        method = m === "EFECTIVO" ? "Efectivo"
                            : m === "TARJETA" || m === "TARJETA_BBVA" ? "Tarjeta BBVA"
                            : m === "TARJETA_GETNET" ? "Tarjeta GETNET"
                            : m || "?";
                    }
                }

                const items = stay.sales_orders?.sales_order_items || [];
                const stayItems: AdditionalItem[] = items
                    .filter((item: any) => item.concept_type !== "ROOM_BASE" && item.concept_type !== "VEHICLE_REQUEST")
                    .map((item: any) => ({
                        description: item.products?.name || CONCEPT_LABELS[item.concept_type] || item.concept_type || "Extra",
                        quantity: item.qty || 1,
                        total: item.total || (item.qty * item.unit_price) || 0,
                        type: item.concept_type,
                    }));

                return {
                    time: new Date(stay.check_in_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
                    room: stay.rooms?.number || "?",
                    plate: stay.vehicle_plate || "-",
                    total: stay.sales_orders?.total || 0,
                    method,
                    items: stayItems,
                };
            });
            setStays(processed);
        }

        setLoading(false);
    }, [shiftId]);

    useEffect(() => { if (shiftId) fetchData(); }, [shiftId, fetchData]);

    // Auto-print after load
    useEffect(() => {
        if (!loading && closing) {
            setTimeout(() => window.print(), 800);
        }
    }, [loading, closing]);

    if (loading) return <div style={styles.loading}>Cargando reporte...</div>;
    if (!closing) return <div style={styles.loading}>No se encontró el corte</div>;

    const employee = closing.employees;
    const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : "N/A";
    const netCash = closing.total_cash - (closing.total_expenses || 0);

    return (
        <>
            <style jsx global>{`
                @page {
                    size: letter;
                    margin: 15mm 12mm;
                }
                body {
                    margin: 0;
                    padding: 0;
                    background: #f5f5f5;
                    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                @media print {
                    body { background: white; }
                    .no-print { display: none !important; }
                    .page-container { box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
                }
            `}</style>

            {/* Print button (hidden on print) */}
            <div className="no-print" style={{
                display: 'flex', justifyContent: 'center', gap: '12px',
                padding: '16px', background: '#1a1a2e',
            }}>
                <button onClick={() => window.print()} style={{
                    padding: '10px 28px', background: '#10b981', color: 'white', border: 'none',
                    borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}>
                    🖨️ Imprimir en HP
                </button>
                <button onClick={() => window.close()} style={{
                    padding: '10px 28px', background: '#374151', color: 'white', border: 'none',
                    borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}>
                    Cerrar
                </button>
            </div>

            <div className="page-container" style={styles.container}>
                {/* ═══ HEADER ═══ */}
                <div style={styles.header}>
                    <div style={styles.headerTop}>
                        <div>
                            <h1 style={styles.title}>Corte de Caja</h1>
                            <p style={styles.subtitle}>Auto Hotel Luxor</p>
                        </div>
                        <div style={styles.headerRight}>
                            <p style={styles.headerDate}>{formatDate(closing.period_start)}</p>
                            <p style={styles.headerTime}>
                                {formatTime(closing.period_start)} → {formatTime(closing.period_end)}
                            </p>
                        </div>
                    </div>
                    <div style={styles.headerMeta}>
                        <span><strong>Empleado:</strong> {employeeName}</span>
                        <span><strong>Turno:</strong> {closing.shift_definitions?.name || "N/A"}</span>
                        <span><strong>ID:</strong> {closing.id.slice(0, 8)}</span>
                    </div>
                </div>

                {/* ═══ RESUMEN DE VENTAS ═══ */}
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Resumen de Ventas</h2>
                    <div style={styles.summaryGrid}>
                        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #10b981' }}>
                            <span style={styles.summaryLabel}>Efectivo</span>
                            <span style={styles.summaryValue}>{formatMoney(closing.total_cash)}</span>
                        </div>
                        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #3b82f6' }}>
                            <span style={styles.summaryLabel}>Tarjeta BBVA</span>
                            <span style={styles.summaryValue}>{formatMoney(closing.total_card_bbva)}</span>
                        </div>
                        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #f43f5e' }}>
                            <span style={styles.summaryLabel}>Tarjeta GETNET</span>
                            <span style={styles.summaryValue}>{formatMoney(closing.total_card_getnet)}</span>
                        </div>
                        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #8b5cf6', background: '#f8fafc' }}>
                            <span style={styles.summaryLabel}>TOTAL VENTAS</span>
                            <span style={{ ...styles.summaryValue, fontSize: '22px', fontWeight: 800 }}>
                                {formatMoney(closing.total_sales)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ═══ GASTOS Y EFECTIVO NETO ═══ */}
                <div style={styles.section}>
                    <h2 style={styles.sectionTitle}>Efectivo</h2>
                    <div style={styles.cashGrid}>
                        <div style={styles.cashRow}>
                            <span>Efectivo cobrado</span>
                            <span style={{ fontWeight: 600 }}>{formatMoney(closing.total_cash)}</span>
                        </div>
                        {closing.total_expenses > 0 && (
                            <div style={{ ...styles.cashRow, color: '#d97706' }}>
                                <span>(-) Gastos ({closing.expenses_count})</span>
                                <span style={{ fontWeight: 600 }}>-{formatMoney(closing.total_expenses)}</span>
                            </div>
                        )}
                        <div style={styles.cashTotal}>
                            <span>Efectivo Neto a Entregar</span>
                            <span>{formatMoney(netCash)}</span>
                        </div>
                    </div>
                </div>

                {/* ═══ GASTOS DETALLE ═══ */}
                {expenses.length > 0 && (
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>Detalle de Gastos</h2>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Hora</th>
                                    <th style={styles.th}>Descripción</th>
                                    <th style={{ ...styles.th, textAlign: 'right' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((exp) => (
                                    <tr key={exp.id}>
                                        <td style={styles.td}>{formatTime(exp.created_at)}</td>
                                        <td style={styles.td}>{exp.description}</td>
                                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: '#d97706' }}>
                                            -{formatMoney(Number(exp.amount))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ═══ DETALLE DE ESTANCIAS ═══ */}
                {stays.length > 0 && (
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>Detalle de Estancias ({stays.length})</h2>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Hora</th>
                                    <th style={styles.th}>Hab.</th>
                                    <th style={styles.th}>Placa</th>
                                    <th style={styles.th}>Método</th>
                                    <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stays.map((stay, idx) => (
                                    <React.Fragment key={idx}>
                                        <tr style={stay.items && stay.items.length > 0 ? { fontWeight: 600 } : {}}>
                                            <td style={styles.td}>{stay.time}</td>
                                            <td style={styles.td}>{stay.room}</td>
                                            <td style={{ ...styles.td, fontSize: '11px' }}>{stay.plate}</td>
                                            <td style={{ ...styles.td, fontSize: '11px' }}>{stay.method}</td>
                                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                                                {formatMoney(stay.total)}
                                            </td>
                                        </tr>
                                        {stay.items && stay.items.map((item, idxi) => (
                                            <tr key={`item-${idx}-${idxi}`}>
                                                <td style={styles.td}></td>
                                                <td colSpan={3} style={{ ...styles.td, paddingLeft: '16px', fontSize: '11px', color: '#6b7280' }}>
                                                    └ {item.quantity > 1 ? `${item.quantity}x ` : ""}{item.description}
                                                </td>
                                                <td style={{ ...styles.td, textAlign: 'right', fontSize: '11px', color: '#6b7280' }}>
                                                    {formatMoney(item.total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ═══ NOTAS ═══ */}
                {closing.notes && (
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>Observaciones</h2>
                        <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>{closing.notes}</p>
                    </div>
                )}

                {/* ═══ FIRMAS ═══ */}
                <div style={styles.signatures}>
                    <div style={styles.signatureBox}>
                        <div style={styles.signatureLine}></div>
                        <p style={styles.signatureLabel}>Entrega: {employeeName}</p>
                    </div>
                    <div style={styles.signatureBox}>
                        <div style={styles.signatureLine}></div>
                        <p style={styles.signatureLabel}>Recibe</p>
                    </div>
                </div>

                {/* ═══ FOOTER ═══ */}
                <div style={styles.footer}>
                    <p>Impreso: {new Date().toLocaleString("es-MX")} — Auto Hotel Luxor</p>
                </div>
            </div>
        </>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    loading: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'sans-serif', fontSize: '16px', color: '#6b7280',
    },
    container: {
        maxWidth: '800px', margin: '20px auto', background: 'white',
        padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        fontSize: '13px', color: '#1f2937', lineHeight: 1.5,
    },
    header: {
        borderBottom: '2px solid #1f2937', paddingBottom: '16px', marginBottom: '24px',
    },
    headerTop: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px',
    },
    title: {
        margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', color: '#0f172a',
    },
    subtitle: {
        margin: '2px 0 0', fontSize: '14px', color: '#64748b', fontWeight: 500,
    },
    headerRight: {
        textAlign: 'right' as const,
    },
    headerDate: {
        margin: 0, fontSize: '13px', fontWeight: 600, color: '#374151', textTransform: 'capitalize' as const,
    },
    headerTime: {
        margin: '2px 0 0', fontSize: '14px', fontWeight: 700, color: '#0f172a',
    },
    headerMeta: {
        display: 'flex', gap: '20px', fontSize: '12px', color: '#64748b',
    },
    section: {
        marginBottom: '20px',
    },
    sectionTitle: {
        fontSize: '14px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' as const,
        letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px',
        marginBottom: '12px',
    },
    summaryGrid: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
    },
    summaryCard: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderRadius: '8px', background: '#fafafa',
        border: '1px solid #f0f0f0',
    },
    summaryLabel: {
        fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const,
        letterSpacing: '0.3px',
    },
    summaryValue: {
        fontSize: '17px', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums',
    },
    cashGrid: {
        border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden',
    },
    cashRow: {
        display: 'flex', justifyContent: 'space-between', padding: '10px 16px',
        borderBottom: '1px solid #f3f4f6', fontSize: '13px',
    },
    cashTotal: {
        display: 'flex', justifyContent: 'space-between', padding: '12px 16px',
        fontSize: '15px', fontWeight: 700, background: '#f0fdf4', color: '#166534',
    },
    table: {
        width: '100%', borderCollapse: 'collapse' as const, fontSize: '12px',
    },
    th: {
        textAlign: 'left' as const, padding: '8px 10px', borderBottom: '2px solid #e5e7eb',
        fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    td: {
        padding: '7px 10px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' as const,
    },
    signatures: {
        display: 'flex', justifyContent: 'space-between', gap: '40px',
        marginTop: '40px', paddingTop: '20px',
    },
    signatureBox: {
        flex: 1, textAlign: 'center' as const,
    },
    signatureLine: {
        borderBottom: '1px solid #9ca3af', marginBottom: '8px', height: '40px',
    },
    signatureLabel: {
        fontSize: '12px', color: '#6b7280', margin: 0,
    },
    footer: {
        textAlign: 'center' as const, marginTop: '24px', paddingTop: '12px',
        borderTop: '1px dashed #d1d5db', fontSize: '11px', color: '#9ca3af',
    },
};

// ─── Page Export ──────────────────────────────────────────────────────

export default function PrintClosingPage() {
    return (
        <Suspense fallback={<div style={styles.loading}>Cargando...</div>}>
            <PrintClosingContent />
        </Suspense>
    );
}
