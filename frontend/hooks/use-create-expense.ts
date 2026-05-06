// hooks/use-create-expense.ts
import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { CreateExpenseData, ShiftExpense } from '@/types/expenses';

/**
 * Hook to create a new expense
 */
export function useCreateExpense() {
    const { success, error: showError } = useToast();
    const [loading, setLoading] = useState(false);

    const createExpense = async (
        data: CreateExpenseData
    ): Promise<ShiftExpense | null> => {
        setLoading(true);
        try {
            // Validate active session
            const { data: session } = await apiClient.get(`/system/crud/shift_sessions/${data.shift_session_id}`) as any;

            if (!session || session.status !== 'active') {
                showError('Error', 'No hay un turno activo o el turno ha finalizado');
                return null;
            }

            // Skip server-side validation for now as it doesn't account for initial cash fund
            // const { data: cashData, error: cashError } = await supabase
            //    .rpc('calculate_available_cash', { p_session_id: data.shift_session_id });
            
            // if (data.amount > (cashData || 0)) { ... }

            // Insert expense
            const { data: expense } = await apiClient.post('/system/crud/shift_expenses', {
                shift_session_id: data.shift_session_id,
                employee_id: data.employee_id,
                expense_type: data.expense_type,
                description: data.description,
                amount: data.amount,
                recipient: data.recipient || null,
                receipt_number: data.receipt_number || null,
                notes: data.notes || null,
                status: 'pending'
            }) as any;

            success('✅ Gasto registrado', 'El gasto se agregó correctamente');
            return expense;
        } catch (err: any) {
            console.error('Error creating expense:', err);
            showError('Error', err.message || 'No se pudo registrar el gasto');
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        createExpense,
        loading
    };
}
