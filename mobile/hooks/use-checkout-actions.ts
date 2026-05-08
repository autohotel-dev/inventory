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
            // UPDATE atómico via RPC para evitar problemas de caché de PostgREST
            const { data: updated, error } = await supabase.rpc('claim_checkout_valet', {
                p_stay_id: stayId,
                p_valet_id: valetId,
                p_person_count: personCount
            });

            if (error) throw error;

            if (!updated) {
                showFeedback('Ya asignada', 'Esta salida ya fue procesada por otro cochero', 'error');
                await onRefresh();
                return false;
            }

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

            // Notificar a recepcionistas activos (no-crítico)
            try {
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
            } catch (notifErr) {
                console.error('Error sending checkout notifications (non-critical):', notifErr);
            }

            showFeedback('¡Éxito!', `Hab. ${roomNumber}: Revisión completada.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error confirming checkout:', error);
            showFeedback('Error', `Error al confirmar salida: ${error?.message || error}`, 'error');
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
            // UPDATE atómico via RPC
            const { data: updated, error } = await supabase.rpc('propose_checkout_valet', {
                p_stay_id: stayId,
                p_valet_id: valetId,
                p_payments: payments
            });

            if (error) throw error;

            if (!updated) {
                showFeedback('Ya asignada', 'Esta salida ya fue avisada por otro cochero', 'error');
                await onRefresh();
                return false;
            }

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
                    description: 'HORA EXTRA (COCHERO)',
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
                    description: 'PERSONA EXTRA (COCHERO)',
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

    const handleVerifyAssetPresence = useCallback(async (
        roomId: string,
        employeeId: string,
        isPresent: boolean,
        assetType: string = 'TV_REMOTE'
    ) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('verify_asset_presence', {
                p_room_id: roomId,
                p_asset_type: assetType,
                p_is_present: isPresent,
                p_employee_id: employeeId
            });

            if (error) throw error;
            
            if (data?.success) {
                // Notificar a recepción si no está
                if (!isPresent) {
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
                                title: '⚠️ Control Extraviado',
                                message: `La habitación reporta un control extraviado. Cobre del depósito.`,
                                data: { type: 'ASSET_MISSING', roomId },
                                is_read: false,
                            }));
                            await supabase.from('notifications').insert(notifications);
                        }
                    }
                }
                
                showFeedback(isPresent ? 'Validado' : 'Reportado', data.message || 'Estado del control actualizado', isPresent ? 'success' : 'warning');
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
            console.error('Error verifying asset:', error);
            showFeedback('Error', 'Hubo un error al verificar el control', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [showFeedback]);

    const handleUpdateLoanedItemStatus = useCallback(async (
        itemId: string,
        newStatus: 'RECUPERADO' | 'PERDIDO',
        stayId: string,
        salesOrderId: string,
        employeeId: string,
        damageAmount: number,
        itemName: string,
        roomNumber: string
    ) => {
        setLoading(true);
        try {
            // Update the loaned item status
            const { error: updateError } = await supabase
                .from('stay_loaned_items')
                .update({ status: newStatus })
                .eq('id', itemId);

            if (updateError) throw updateError;

            // If missing and damageAmount > 0, create a damage charge
            if (newStatus === 'PERDIDO' && damageAmount > 0) {
                const { error: chargeError } = await supabase
                    .from('sales_order_items')
                    .insert({
                        sales_order_id: salesOrderId,
                        concept_type: 'DAMAGE_CHARGE',
                        description: `DAÑO: Faltante de ${itemName}`,
                        unit_price: damageAmount,
                        qty: 1,
                        total: damageAmount,
                        is_paid: false
                    });
                
                if (chargeError) throw chargeError;

                // Notify reception
                const { data: receptionSessions } = await supabase
                    .from('shift_sessions')
                    .select('employees!inner(auth_user_id, role)')
                    .eq('status', 'active')
                    .in('employees.role', ['receptionist', 'admin', 'supervisor', 'gerente']);

                if (receptionSessions && receptionSessions.length > 0) {
                    const uniqueUserIds = new Set<string>();
                    receptionSessions.forEach((session: any) => {
                        if (session.employees?.auth_user_id) uniqueUserIds.add(session.employees.auth_user_id);
                    });

                    if (uniqueUserIds.size > 0) {
                        const notifications = Array.from(uniqueUserIds).map(userId => ({
                            user_id: userId,
                            type: 'system_alert',
                            title: '⚠️ Artículo Faltante',
                            message: `Falta ${itemName} en Hab. ${roomNumber}. Cargo por daño generado automáticamente.`,
                            data: { type: 'ASSET_MISSING', stayId },
                            is_read: false,
                        }));
                        await supabase.from('notifications').insert(notifications);
                    }
                }
            }

            showFeedback(
                newStatus === 'RECUPERADO' ? 'Recuperado' : 'Faltante Reportado', 
                newStatus === 'RECUPERADO' ? `${itemName} marcado como recuperado.` : `Cargo por ${itemName} generado.`, 
                newStatus === 'RECUPERADO' ? 'success' : 'warning'
            );
            
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error updating loaned item:', error);
            showFeedback('Error', 'No se pudo actualizar el estado del artículo.', 'error');
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
        handleRegisterExtraPerson,
        handleVerifyAssetPresence,
        handleUpdateLoanedItemStatus
    };
}
