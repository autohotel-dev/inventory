// hooks/use-create-expense.ts
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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
            const supabase = createClient();

            // Validate active session
            const { data: session, error: sessionError } = await supabase
                .from('shift_sessions')
                .select('*')
                .eq('id', data.shift_session_id)
                .eq('status', 'active')
                .maybeSingle();

            if (sessionError) throw sessionError;

            if (!session) {
                showError('Error', 'No hay un turno activo');
                return null;
            }

            // Skip server-side validation for now as it doesn't account for initial cash fund
            // const { data: cashData, error: cashError } = await supabase
            //    .rpc('calculate_available_cash', { p_session_id: data.shift_session_id });
            
            // if (data.amount > (cashData || 0)) { ... }

            // Insert expense
            const { data: expense, error: insertError } = await supabase
                .from('shift_expenses')
                .insert({
                    shift_session_id: data.shift_session_id,
                    employee_id: data.employee_id,
                    expense_type: data.expense_type,
                    description: data.description,
                    amount: data.amount,
                    recipient: data.recipient || null,
                    receipt_number: data.receipt_number || null,
                    notes: data.notes || null,
                    status: 'pending'
                })
                .select()
                .single();

            if (insertError) throw insertError;

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
