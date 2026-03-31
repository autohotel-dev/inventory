import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFeedback } from '../contexts/feedback-context';
import { PaymentEntry } from '../lib/payment-types';

import { logActivity } from '../lib/activity-logger';

export function useCheckoutActions(onRefresh: () => Promise<void>) {
    const [loading, setLoading] = useState(false);
    const { showFeedback } = useFeedback();

    const handleConfirmCheckout = useCallback(async (
        stayId: string, 
        roomNumber: string, 
        valetId: string, 
        personCount: number,
        checklist?: any
    ) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('room_stays')
                .update({
                    checkout_valet_employee_id: valetId,
                    current_people: personCount,
                    // Señalizar a recepción que el cochero ya completó la revisión de salida
                    valet_checkout_requested_at: new Date().toISOString()
                })
                .eq('id', stayId);

            if (error) throw error;

            // Log activity with checklist details (SOP 1 & 5)
            await logActivity({
                action: 'CHECKOUT_REVIEW',
                room_number: roomNumber,
                valet_id: valetId,
                details: `Revisión de salida completada. Persona count: ${personCount}. Checklist: ${JSON.stringify(checklist)}`
            });

            // Obtener nombre del cochero
            let valetName = 'Cochero';
            try {
                const { data: emp } = await supabase
                    .from('employees')
                    .select('first_name')
                    .eq('id', valetId)
                    .single();
                if (emp?.first_name) valetName = emp.first_name;
            } catch { /* fallback */ }

            // Notificar a recepcionistas activos
            const { data: receptionSessions } = await supabase
                .from('shift_sessions')
                .select('employees!inner(auth_user_id, role)')
                .eq('status', 'active')
                .in('employees.role', ['receptionist', 'admin', 'supervisor', 'gerente']);

            if (receptionSessions && receptionSessions.length > 0) {
                const uniqueUserIds = new Set<string>();
                receptionSessions.forEach((session: any) => {
                    if (session.employees?.auth_user_id) {
                        uniqueUserIds.add(session.employees.auth_user_id);
                    }
                });

                if (uniqueUserIds.size > 0) {
                    const notifications = Array.from(uniqueUserIds).map(userId => ({
                        user_id: userId,
                        type: 'system_alert',
                        title: '🚗 Salida Lista',
                        message: `${valetName} ha revisado la Hab. ${roomNumber}, puedes darle salida.`,
                        data: { type: 'CHECKOUT_READY', roomNumber, stayId },
                        is_read: false,
                    }));
                    await supabase.from('notifications').insert(notifications);
                }
            }

            showFeedback('¡Éxito!', `Hab. ${roomNumber}: Revisión completada.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error confirming checkout:', error);
            showFeedback('Error', 'Error al confirmar salida', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleProposeCheckout = useCallback(async (
        stayId: string,
        roomNumber: string,
        valetId: string,
        payments: PaymentEntry[]
    ) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('room_stays')
                .update({
                    valet_checkout_requested_at: new Date().toISOString(),
                    checkout_valet_employee_id: valetId,
                    checkout_payment_data: payments // Save the pre-filled payment data
                })
                .eq('id', stayId);

            if (error) throw error;

            // Obtener nombre del cochero
            let valetName = 'Cochero';
            try {
                const { data: emp } = await supabase
                    .from('employees')
                    .select('first_name')
                    .eq('id', valetId)
                    .single();
                if (emp?.first_name) valetName = emp.first_name;
            } catch { /* fallback */ }

            // Notificar a recepcionistas activos
            const { data: receptionSessions } = await supabase
                .from('shift_sessions')
                .select('employees!inner(auth_user_id, role)')
                .eq('status', 'active')
                .in('employees.role', ['receptionist', 'admin', 'supervisor', 'gerente']);

            if (receptionSessions && receptionSessions.length > 0) {
                const uniqueUserIds = new Set<string>();
                receptionSessions.forEach((session: any) => {
                    if (session.employees?.auth_user_id) {
                        uniqueUserIds.add(session.employees.auth_user_id);
                    }
                });

                if (uniqueUserIds.size > 0) {
                    const notifications = Array.from(uniqueUserIds).map(userId => ({
                        user_id: userId,
                        type: 'system_alert',
                        title: '🚗 Solicitud de Salida',
                        message: `${valetName} solicita salida de Hab. ${roomNumber}, puedes darle salida.`,
                        data: { type: 'CHECKOUT_REQUESTED', roomNumber, stayId },
                        is_read: false,
                    }));
                    await supabase.from('notifications').insert(notifications);
                }
            }

            showFeedback('¡Éxito!', `Hab. ${roomNumber}: Salida notificada correctamente.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error proposing checkout:', error);
            showFeedback('Error', 'Error al notificar salida', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleReportDamage = useCallback(async (
        stayId: string,
        salesOrderId: string,
        roomNumber: string,
        description: string,
        amount: number,
        payments: PaymentEntry[],
        valetId: string
    ) => {
        setLoading(true);
        try {
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            const { data: item, error: itemError } = await supabase
                .from('sales_order_items')
                .insert({
                    sales_order_id: salesOrderId,
                    concept_type: 'DAMAGE_CHARGE',
                    description: `DAÑO: ${description}`,
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                })
                .select()
                .single();

            if (itemError) throw itemError;

            for (const p of payments) {
                const { error: insErr } = await supabase.from('payments').insert({
                    sales_order_id: salesOrderId,
                    amount: p.amount,
                    payment_method: p.method,
                    terminal_code: p.terminal,
                    card_last_4: p.cardLast4,
                    card_type: p.cardType,
                    reference: p.reference || `VALET_DAMAGE:${item?.id}`,
                    concept: 'DAMAGE_CHARGE',
                    status: 'COBRADO_POR_VALET',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                });
                if (insErr) throw insErr;
            }

            showFeedback('✅ Daño Informado', `Hab. ${roomNumber}: Cargo por $${amount.toFixed(2)} generado. Corrobora el cobro en recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error reporting damage:', error);
            showFeedback('Error', 'No se pudo registrar el daño.', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleRegisterExtraHour = useCallback(async (
        salesOrderId: string,
        roomNumber: string,
        amount: number,
        payments: PaymentEntry[],
        valetId: string
    ) => {
        setLoading(true);
        try {
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            const { data: item, error: itemError } = await supabase
                .from('sales_order_items')
                .insert({
                    sales_order_id: salesOrderId,
                    concept_type: 'EXTRA_HOUR',
                    description: 'HORA EXTRA (VALET)',
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                })
                .select()
                .single();

            if (itemError) throw itemError;

            for (const p of payments) {
                const { error: insErr } = await supabase.from('payments').insert({
                    sales_order_id: salesOrderId,
                    amount: p.amount,
                    payment_method: p.method,
                    terminal_code: p.terminal,
                    card_last_4: p.cardLast4,
                    card_type: p.cardType,
                    reference: p.reference || `VALET_HOUR:${item?.id}`,
                    concept: 'HORA_EXTRA',
                    status: 'COBRADO_POR_VALET',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                });
                if (insErr) throw insErr;
            }

            showFeedback('✅ Hora Extra Informada', `Hab. ${roomNumber}: Cobro registrado. Entrega el dinero en recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error registering extra hour:', error);
            showFeedback('Error', 'No se pudo registrar la hora extra.', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleRegisterExtraPerson = useCallback(async (
        salesOrderId: string,
        roomNumber: string,
        amount: number,
        payments: PaymentEntry[],
        valetId: string
    ) => {
        setLoading(true);
        try {
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'active')
                .maybeSingle();

            const { data: item, error: itemError } = await supabase
                .from('sales_order_items')
                .insert({
                    sales_order_id: salesOrderId,
                    concept_type: 'EXTRA_PERSON',
                    description: 'PERSONA EXTRA (VALET)',
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                })
                .select()
                .single();

            if (itemError) throw itemError;

            for (const p of payments) {
                const { error: insErr } = await supabase.from('payments').insert({
                    sales_order_id: salesOrderId,
                    amount: p.amount,
                    payment_method: p.method,
                    terminal_code: p.terminal,
                    card_last_4: p.cardLast4,
                    card_type: p.cardType,
                    reference: p.reference || `VALET_PERSON:${item?.id}`,
                    concept: 'PERSONA_EXTRA',
                    status: 'COBRADO_POR_VALET',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                });
                if (insErr) throw insErr;
            }

            showFeedback('✅ Persona Extra Informada', `Hab. ${roomNumber}: Cobro registrado. Entrega el dinero en recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error registering extra person:', error);
            showFeedback('Error', 'No se pudo registrar la persona extra.', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    return {
        loading,
        handleConfirmCheckout,
        handleProposeCheckout,
        handleReportDamage,
        handleRegisterExtraHour,
        handleRegisterExtraPerson
    };
}
