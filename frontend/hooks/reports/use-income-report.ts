import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { IncomeEntry, IncomeReportProps, IncomeTotals } from "@/components/reports/income-report/types";

export function useIncomeReport({
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
    const [currentShift, setCurrentShift] = useState<any>(null);

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

            if (reportType === "shift" && shiftId) {
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

                let shift: any = null;

                if (closingData) {
                    const employee = (closingData.employees as any);
                    shift = {
                        shift_start: closingData.period_start,
                        shift_end: closingData.period_end,
                        employee_name: employee ? `${employee.first_name} ${employee.last_name}` : undefined
                    };
                }

                if (!shift) {
                    const { data: session } = await supabase
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

                    if (session) {
                        const employee = (session.employees as any);
                        const employeeName = employee
                            ? `${employee.first_name} ${employee.last_name}`
                            : undefined;

                        shift = {
                            shift_start: session.clock_in_at,
                            shift_end: null,
                            employee_name: employeeName
                        };
                    }
                }

                if (shift) {
                    setShiftInfo(shift);
                    query = query.gte("check_in_at", shift.shift_start);
                    if (shift.shift_end) {
                        query = query.lte("check_in_at", shift.shift_end);
                    } else {
                        query = query.lte("check_in_at", new Date().toISOString());
                    }
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

            if (statusFilter && statusFilter !== "all") {
                query = query.eq("status", statusFilter);
            } else {
                query = query.in("status", ["ACTIVA", "FINALIZADA", "CANCELADA"]);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching income data:", error);
                return;
            }

            const filteredData = (data || []).filter((stay: any) => {
                const roomNum = stay.rooms?.number;
                return roomNum !== '13' && roomNum !== '113' && roomNum !== 'Habitación 13' && roomNum !== 'Habitación 113';
            });

            let processedEntries: IncomeEntry[] = filteredData.map((stay: any, index: number) => {
                const order = stay.sales_orders;
                const items = Array.isArray(order) ? (order[0]?.sales_order_items || []) : (order?.sales_order_items || []);

                const rawOrderData = order ? (Array.isArray(order) ? order : [order]) : [];
                const allObservedPayments: any[] = [];
                
                rawOrderData.forEach((o: any) => {
                    if (o?.payments) {
                        const pList = Array.isArray(o.payments) ? o.payments : [o.payments];
                        allObservedPayments.push(...pList);
                    }
                });

                const idUniquePaymentsMap = new Map();
                allObservedPayments.forEach((p: any) => {
                    if (p.id) idUniquePaymentsMap.set(p.id, p);
                });

                const filteredList = Array.from(idUniquePaymentsMap.values()).filter(
                    (p: any) => 
                        p.status !== 'PENDIENTE' && 
                        p.concept?.toUpperCase() !== 'CHECKOUT' &&
                        p.payment_method !== 'PENDIENTE'
                );

                const contentUniqueMap = new Map();
                filteredList.forEach((p: any) => {
                    const key = `${p.amount}-${p.payment_method}-${p.card_last_4 || 'none'}`;
                    if (!contentUniqueMap.has(key) || p.concept) {
                        contentUniqueMap.set(key, p);
                    }
                });

                const payments = Array.from(contentUniqueMap.values());
                
                let roomPrice = 0;
                let extra = 0;
                let consumption = 0;

                if (stay.status === "CANCELADA") {
                    roomPrice = Array.isArray(order) ? (order[0]?.total || 0) : (order?.total || 0);
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

    useEffect(() => {
        fetchCurrentShift();
    }, [fetchCurrentShift]);

    useEffect(() => {
        fetchIncomeData();
    }, [fetchIncomeData]);

    const calculateTotals = useCallback((): IncomeTotals => {
        return entries.reduce(
            (acc, entry) => ({
                roomPrice: acc.roomPrice + entry.room_price,
                extra: acc.extra + entry.extra,
                consumption: acc.consumption + entry.consumption,
                total: acc.total + entry.total,
            }),
            { roomPrice: 0, extra: 0, consumption: 0, total: 0 }
        );
    }, [entries]);

    return {
        entries,
        loading,
        reportNumber,
        shiftInfo,
        currentShift,
        calculateTotals
    };
}
