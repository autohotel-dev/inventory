// hooks/use-create-employee-charge.ts
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
    CreateEmployeeChargeData,
    EmployeeCharge,
    calculateChargeTotal,
} from '@/types/employee-charges';

/**
 * Hook to create a new employee charge.
 * Validates the active session, calculates totals, and inserts into shift_employee_charges.
 */
export function useCreateEmployeeCharge() {
    const { success, error: showError } = useToast();
    const [loading, setLoading] = useState(false);

    const createCharge = async (
        data: CreateEmployeeChargeData
    ): Promise<EmployeeCharge | null> => {
        setLoading(true);
        try {
            const supabase = createClient();

            // Validate active session
            const { data: session, error: sessionError } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('id', data.shift_session_id)
                .eq('status', 'active')
                .order("clock_in_at", { ascending: false }).limit(1).maybeSingle();

            if (sessionError) throw sessionError;

            if (!session) {
                showError('Error', 'No hay un turno activo');
                return null;
            }

            // Calculate totals
            const { subtotal, discountAmount, total } = calculateChargeTotal(
                data.unit_price,
                data.quantity,
                data.discount_type || null,
                data.discount_value || 0
            );

            // Insert charge
            const { data: charge, error: insertError } = await supabase
                .from('shift_employee_charges')
                .insert({
                    shift_session_id: data.shift_session_id,
                    registered_by: data.registered_by,
                    charged_to: data.charged_to,
                    charge_type: data.charge_type,
                    description: data.description,
                    unit_price: data.unit_price,
                    quantity: data.quantity,
                    discount_type: data.discount_type || null,
                    discount_value: data.discount_value || 0,
                    discount_amount: discountAmount,
                    subtotal,
                    total,
                    payment_method: data.payment_method,
                    notes: data.notes || null,
                    status: 'pending',
                })
                .select()
                .single();

            if (insertError) throw insertError;

            const paymentLabel = data.payment_method === 'COURTESY'
                ? '(Cortesía)'
                : data.payment_method === 'DEDUCCION_NOMINA'
                    ? '(Desc. Nómina)'
                    : `$${total.toFixed(2)}`;

            success(
                '✅ Cargo registrado',
                `${data.description} — ${paymentLabel}`
            );
            return charge;
        } catch (err: any) {
            console.error('Error creating employee charge:', err);
            showError('Error', err.message || 'No se pudo registrar el cargo');
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        createCharge,
        loading,
    };
}
