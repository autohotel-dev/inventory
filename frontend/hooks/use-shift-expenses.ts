// hooks/use-shift-expenses.ts
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
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
            // Using exact matching for the shift_session_id and status != rejected
            const { data } = await apiClient.get(`/system/crud/shift_expenses?shift_session_id=${sessionId}`) as any;
            
            // Filter out rejected locally since simple crud might not support neq out of the box easily
            const expensesList = (Array.isArray(data) ? data : []).filter((e: any) => e.status !== 'rejected');
            setExpenses(expensesList);

            const total = expensesList.reduce((sum: number, expense: any) => sum + Number(expense.amount), 0);
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
