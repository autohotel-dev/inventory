// hooks/use-employee-charges.ts
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EmployeeCharge } from '@/types/employee-charges';

/**
 * Hook to fetch and manage employee charges for a shift session.
 * Returns the list, totals, and a refetch method.
 */
export function useEmployeeCharges(sessionId: string | null) {
    const [charges, setCharges] = useState<EmployeeCharge[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalCharges, setTotalCharges] = useState(0);
    const [totalDiscount, setTotalDiscount] = useState(0);

    const fetchCharges = async () => {
        if (!sessionId) {
            setCharges([]);
            setTotalCharges(0);
            setTotalDiscount(0);
            return;
        }

        setLoading(true);
        try {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('shift_employee_charges')
                .select(`
                    *,
                    charged_employee:charged_to(id, first_name, last_name, role),
                    registered_employee:registered_by(id, first_name, last_name)
                `)
                .eq('shift_session_id', sessionId)
                .neq('status', 'rejected')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const chargesList = (data || []) as EmployeeCharge[];
            setCharges(chargesList);

            const totals = chargesList.reduce(
                (acc, charge) => ({
                    total: acc.total + Number(charge.total),
                    discount: acc.discount + Number(charge.discount_amount),
                }),
                { total: 0, discount: 0 }
            );

            setTotalCharges(totals.total);
            setTotalDiscount(totals.discount);
        } catch (error) {
            console.error('Error fetching employee charges:', error);
            setCharges([]);
            setTotalCharges(0);
            setTotalDiscount(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCharges();
    }, [sessionId]);

    return {
        charges,
        totalCharges,
        totalDiscount,
        loading,
        refetch: fetchCharges,
    };
}
