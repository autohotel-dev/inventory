import { apiClient } from "@/lib/api/client";
import { useState, useEffect, useCallback } from "react";
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
        try {
            const { apiClient } = await import("@/lib/api/client");
            const { data } = await apiClient.get('/system/crud/shift_sessions?status=active&limit=1');
            const session = data && data.length > 0 ? data[0] : null;

            if (session && session.employees) {
                const emp = session.employees;
                setCurrentShift({
                    id: session.id,
                    employee_name: emp ? `${emp.first_name} ${emp.last_name}` : "Desconocido"
                });
            } else if (session) {
                setCurrentShift({ id: session.id, employee_name: "Desconocido" });
            }
        } catch (error) {
            console.error("Error fetching current shift:", error);
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
