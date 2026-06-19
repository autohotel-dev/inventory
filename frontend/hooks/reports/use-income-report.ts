import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConsumptionDetail, DamageItem, ExtraDetail, IncomeEntry, IncomeReportProps, IncomeTotals } from "@/components/reports/income-report/types";

function mapEntry(e: any): IncomeEntry {
    return {
        no: Number(e.no),
        time: e.time || '',
        vehicle_plate: e.vehicle_plate || '',
        room_number: e.room_number || '',
        room_price: Number(e.room_price) || 0,
        extra: Number(e.extra) || 0,
        consumption: Number(e.consumption) || 0,
        damage: Number(e.damage) || 0,
        total: Number(e.total) || 0,
        payment_method: e.payment_method || 'PENDIENTE',
        card_type: e.card_type,
        card_last_4: e.card_last_4,
        terminal_code: e.terminal_code,
        stay_status: e.stay_status,
        checkout_valet_name: e.checkout_valet_name || '—',
        checkin_valet_name: e.checkin_valet_name || '—',
        receptionist_name: e.receptionist_name || '—',
        shift_name: e.shift_name || '—',
        original_checkin_employee: e.original_checkin_employee || '—',
        is_from_previous_shift: e.is_from_previous_shift || false,
        payments: (e.payments || []).map((p: any) => ({
            payment_method: p.payment_method,
            amount: Number(p.amount) || 0,
            card_type: p.card_type,
            card_last_4: p.card_last_4,
            terminal_code: p.terminal_code,
        })),
        consumption_details: (e.consumption_details || []).map((c: any): ConsumptionDetail => ({
            product_name: c.product_name || 'Consumo',
            qty: Number(c.qty) || 0,
            unit_price: Number(c.unit_price) || 0,
            total: Number(c.total) || 0,
            created_at: c.created_at || '',
            delivery_status: c.delivery_status || 'N/A',
            accepted_by_name: c.accepted_by_name || undefined,
            picked_up_by_name: c.picked_up_by_name || undefined,
            delivered_at: c.delivered_at || undefined,
            payment_by_name: c.payment_by_name || undefined,
            payment_method: c.payment_method || undefined,
            payment_at: c.payment_at || undefined,
        })),
        extra_details: (e.extra_details || []).map((x: any): ExtraDetail => ({
            concept_type: x.concept_type || '',
            concept_label: x.concept_label || x.concept_type || '',
            qty: Number(x.qty) || 0,
            unit_price: Number(x.unit_price) || 0,
            total: Number(x.total) || 0,
            created_at: x.created_at || '',
            registered_by_name: x.registered_by_name || undefined,
        })),
    };
}

export function useIncomeReport({
    reportType,
    shiftId,
    startDate,
    endDate,
    paymentMethodFilter,
    roomFilter,
    statusFilter = "all",
    page = 1,
    pageSize = 50,
}: IncomeReportProps) {
    const [entries, setEntries] = useState<IncomeEntry[]>([]);
    const [totals, setTotals] = useState<IncomeTotals>({ roomPrice: 0, extra: 0, consumption: 0, damages: 0, total: 0 });
    const [damageItems, setDamageItems] = useState<DamageItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [reportNumber, setReportNumber] = useState("0001");
    const [shiftInfo, setShiftInfo] = useState<any>(null);
    const [currentShift, setCurrentShift] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [employeeCharges, setEmployeeCharges] = useState<any[]>([]);
    const [totalEmployeeCharges, setTotalEmployeeCharges] = useState(0);
    const [totalEmployeeChargesCash, setTotalEmployeeChargesCash] = useState(0);

    const fetchIncomeData = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();

        try {
            // ─── Single RPC call replaces 3-5 queries + JS processing ────────
            const { data: rpcResult, error } = await supabase.rpc('get_income_report', {
                p_report_type: reportType,
                p_shift_id: shiftId || null,
                p_start_date: startDate?.toISOString() || null,
                p_end_date: endDate?.toISOString() || null,
                p_payment_method_filter: paymentMethodFilter || 'all',
                p_room_filter: roomFilter || 'all',
                p_status_filter: statusFilter || 'all',
                p_page: page,
                p_page_size: pageSize
            });

            if (error) throw error;

            if (rpcResult?.shiftInfo) {
                setShiftInfo(rpcResult.shiftInfo);
            }
            if (rpcResult?.currentShift) {
                setCurrentShift(rpcResult.currentShift);
            }
            if (rpcResult?.totals) {
                setTotals({
                    roomPrice: Number(rpcResult.totals.roomPrice) || 0,
                    extra: Number(rpcResult.totals.extra) || 0,
                    consumption: Number(rpcResult.totals.consumption) || 0,
                    damages: Number(rpcResult.totals.damage) || 0,
                    total: Number(rpcResult.totals.total) || 0,
                });
            }
            if (rpcResult?.damage_items) {
                setDamageItems(rpcResult.damage_items || []);
            }
            // Expenses and employee charges (added for pre-corte)
            setExpenses(rpcResult?.expenses || []);
            setTotalExpenses(Number(rpcResult?.totalExpenses) || 0);
            setEmployeeCharges(rpcResult?.employeeCharges || []);
            setTotalEmployeeCharges(Number(rpcResult?.totalEmployeeCharges) || 0);
            setTotalEmployeeChargesCash(Number(rpcResult?.totalEmployeeChargesCash) || 0);
            if (rpcResult?.totalCount !== undefined) {
                setTotalCount(rpcResult.totalCount);
            }

            setEntries((rpcResult?.entries || []).map(mapEntry));
        } catch (error) {
            console.error("Error processing income data:", error);
        } finally {
            setLoading(false);
        }
    }, [reportType, shiftId, startDate, endDate, paymentMethodFilter, roomFilter, statusFilter, page, pageSize]);

    useEffect(() => {
        fetchIncomeData();
    }, [fetchIncomeData]);

    const fetchAllForPrint = useCallback(async () => {
        const supabase = createClient();
        const { data: rpcResult, error } = await supabase.rpc('get_income_report', {
            p_report_type: reportType,
            p_shift_id: shiftId || null,
            p_start_date: startDate?.toISOString() || null,
            p_end_date: endDate?.toISOString() || null,
            p_payment_method_filter: paymentMethodFilter || 'all',
            p_room_filter: roomFilter || 'all',
            p_status_filter: statusFilter || 'all',
            p_page: 1,
            p_page_size: null // Return all rows
        });
        
        if (error) {
            console.error("Error fetching all entries:", error);
            return { entries: [], totals: { roomPrice: 0, extra: 0, consumption: 0, damage: 0, total: 0 }, damageItems: [] };
        }

        const processedEntries: IncomeEntry[] = (rpcResult?.entries || []).map(mapEntry);

        const mappedTotals = rpcResult?.totals ? {
            roomPrice: Number(rpcResult.totals.roomPrice) || 0,
            extra: Number(rpcResult.totals.extra) || 0,
            consumption: Number(rpcResult.totals.consumption) || 0,
            damages: Number(rpcResult.totals.damage) || 0,
            total: Number(rpcResult.totals.total) || 0,
        } : { roomPrice: 0, extra: 0, consumption: 0, damage: 0, total: 0 };

        return { 
            entries: processedEntries, 
            totals: mappedTotals, 
            damageItems: rpcResult?.damage_items || [] 
        };
    }, [reportType, shiftId, startDate, endDate, paymentMethodFilter, roomFilter, statusFilter]);

    return {
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
    };
}
