import { apiClient } from "@/lib/api/client";
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
            ;

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
        try {
            const { apiClient } = await import("@/lib/api/client");
            
            let actualSessionId = shiftId;
            if (reportType === "shift" && (!actualSessionId || actualSessionId === 'current') && currentShift) {
                actualSessionId = currentShift.id;
            }

            const { data } = await apiClient.get('/hr/reports/income', {
                params: {
                    report_type: reportType,
                    shift_id: reportType === "shift" ? actualSessionId : undefined,
                    start_date: reportType === "dateRange" && startDate ? startDate.toISOString() as any : undefined,
                    end_date: reportType === "dateRange" && endDate ? endDate.toISOString() : undefined,
                    status_filter: statusFilter,
                    room_filter: roomFilter,
                    payment_method_filter: paymentMethodFilter
                }
            });
            
            setEntries(data.entries || []);
        } catch (error) {
            console.error("Error processing income data:", error);
        } finally {
            setLoading(false);
        }
    }, [reportType, shiftId, startDate, endDate, paymentMethodFilter, roomFilter, statusFilter, currentShift]);

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
