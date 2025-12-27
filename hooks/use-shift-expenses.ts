// hooks/use-shift-expenses.ts
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShiftExpense } from '@/types/expenses';

/**
 * Hook to fetch and manage shift expenses
 */
export function useShiftExpenses(sessionId: string | null) {
    const [expenses, setExpenses] = useState<ShiftExpense[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalExpenses, setTotalExpenses] = useState(0);

    const fetchExpenses = async () => {
        if (!sessionId) {
            setExpenses([]);
            setTotalExpenses(0);
            return;
        }

        setLoading(true);
        try {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('shift_expenses')
                .select('*')
                .eq('shift_session_id', sessionId)
                .neq('status', 'rejected')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const expensesList = data || [];
            setExpenses(expensesList);

            const total = expensesList.reduce((sum, expense) => sum + Number(expense.amount), 0);
            setTotalExpenses(total);
        } catch (error) {
            console.error('Error fetching expenses:', error);
            setExpenses([]);
            setTotalExpenses(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, [sessionId]);

    return {
        expenses,
        totalExpenses,
        loading,
        refetch: fetchExpenses
    };
}
