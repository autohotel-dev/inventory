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
    page = 1,
    pageSize = 50,
}: IncomeReportProps) {
    const [entries, setEntries] = useState<IncomeEntry[]>([]);
    const [totals, setTotals] = useState<IncomeTotals>({ roomPrice: 0, extra: 0, consumption: 0, total: 0 });
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [reportNumber, setReportNumber] = useState("0001");
    const [shiftInfo, setShiftInfo] = useState<any>(null);
    const [currentShift, setCurrentShift] = useState<any>(null);

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
                setTotals(rpcResult.totals);
            }
            if (rpcResult?.totalCount !== undefined) {
                setTotalCount(rpcResult.totalCount);
            }

            const processedEntries: IncomeEntry[] = (rpcResult?.entries || []).map((e: any) => ({
                no: Number(e.no),
                time: e.time || '',
                vehicle_plate: e.vehicle_plate || '',
                room_number: e.room_number || '',
                room_price: Number(e.room_price) || 0,
                extra: Number(e.extra) || 0,
                consumption: Number(e.consumption) || 0,
                total: Number(e.total) || 0,
                payment_method: e.payment_method || 'PENDIENTE',
                card_type: e.card_type,
                card_last_4: e.card_last_4,
                terminal_code: e.terminal_code,
                stay_status: e.stay_status,
                checkout_valet_name: e.checkout_valet_name || '—',
                payments: (e.payments || []).map((p: any) => ({
                    payment_method: p.payment_method,
                    amount: Number(p.amount) || 0,
                    card_type: p.card_type,
                    card_last_4: p.card_last_4,
                    terminal_code: p.terminal_code,
                })),
            }));

            setEntries(processedEntries);
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
            return { entries: [], totals: { roomPrice: 0, extra: 0, consumption: 0, total: 0 } };
        }

        const processedEntries: IncomeEntry[] = (rpcResult?.entries || []).map((e: any) => ({
            no: Number(e.no),
            time: e.time || '',
            vehicle_plate: e.vehicle_plate || '',
            room_number: e.room_number || '',
            room_price: Number(e.room_price) || 0,
            extra: Number(e.extra) || 0,
            consumption: Number(e.consumption) || 0,
            total: Number(e.total) || 0,
            payment_method: e.payment_method || 'PENDIENTE',
            card_type: e.card_type,
            card_last_4: e.card_last_4,
            terminal_code: e.terminal_code,
            stay_status: e.stay_status,
            checkout_valet_name: e.checkout_valet_name || '—',
            payments: (e.payments || []).map((p: any) => ({
                payment_method: p.payment_method,
                amount: Number(p.amount) || 0,
                card_type: p.card_type,
                card_last_4: p.card_last_4,
                terminal_code: p.terminal_code,
            })),
        }));

        return { entries: processedEntries, totals: rpcResult?.totals || { roomPrice: 0, extra: 0, consumption: 0, total: 0 } };
    }, [reportType, shiftId, startDate, endDate, paymentMethodFilter, roomFilter, statusFilter]);

    return {
        entries,
        totals,
        totalCount,
        loading,
        reportNumber,
        shiftInfo,
        currentShift,
        fetchAllForPrint
    };
}
