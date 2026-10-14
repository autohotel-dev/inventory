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

            // Notificar a recepcionistas activos (no bloquear si falla)
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
                            title: '🚗 Solicitud de Salida',
                            message: `${valetName} solicita salida de Hab. ${roomNumber}, puedes darle salida.`,
                            data: { type: 'CHECKOUT_REQUESTED', roomNumber, stayId },
                            is_read: false,
                        }));
                        await supabase.from('notifications').insert(notifications);
                    }
                }
            } catch (notifError) {
                console.warn('Error sending checkout notification (non-blocking):', notifError);
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

    // Hora extra / persona extra / daño cobrados por el cochero. El cochero solo REPORTA: queda
    // una solicitud y recepción la aprueba (genera el cargo, extiende la salida o suma la persona)
    // o la rechaza. El requestId hace que un doble toque o reintento no cree dos solicitudes.
    const registerCharge = useCallback(async (
        chargeType: 'EXTRA_HOUR' | 'EXTRA_PERSON' | 'DAMAGE_CHARGE',
        stayId: string,
        roomNumber: string,
        amount: number,
        payments: PaymentEntry[],
        requestId: string,
        description?: string
    ) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('valet_register_charge', {
                p_stay_id: stayId,
                p_charge_type: chargeType,
                p_amount: amount,
                p_payments: payments.map(p => ({
                    amount: p.amount,
                    method: p.method,
                    terminal: p.terminal,
                    cardType: p.cardType,
                    cardLast4: p.cardLast4,
                    reference: p.reference,
                })),
                p_description: description || null,
                p_request_id: requestId,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'No se pudo enviar el cobro');

            const label = chargeType === 'EXTRA_HOUR' ? 'Hora extra' : chargeType === 'EXTRA_PERSON' ? 'Persona extra' : 'Daño';
            showFeedback(`📨 ${label} enviada a recepción`, `Hab. ${roomNumber}: $${amount.toFixed(2)}. Recepción la aprueba; te llegará el aviso. Entrega el dinero en recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error(`Error registering ${chargeType}:`, error);
            showFeedback('Error', error?.message || 'No se pudo enviar el cobro.', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleReportDamage = useCallback((
        stayId: string, roomNumber: string, description: string, amount: number, payments: PaymentEntry[], requestId: string
    ) => registerCharge('DAMAGE_CHARGE', stayId, roomNumber, amount, payments, requestId, description), [registerCharge]);

    const handleRegisterExtraHour = useCallback((
        stayId: string, roomNumber: string, amount: number, payments: PaymentEntry[], requestId: string
    ) => registerCharge('EXTRA_HOUR', stayId, roomNumber, amount, payments, requestId), [registerCharge]);

    const handleRegisterExtraPerson = useCallback((
        stayId: string, roomNumber: string, amount: number, payments: PaymentEntry[], requestId: string
    ) => registerCharge('EXTRA_PERSON', stayId, roomNumber, amount, payments, requestId), [registerCharge]);

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

    // Recuperado / Faltante de loza y artículos prestados.
    // La base registra al cochero de la sesión y, si falta, avisa a recepción; recepción decide
    // si se cobra o se perdona (ya no hay cargo automático). Se conservan los parámetros que
    // pasan las pantallas aunque la función de la base ya no los necesite.
    const handleUpdateLoanedItemStatus = useCallback(async (
        itemId: string,
        newStatus: 'RECUPERADO' | 'PERDIDO',
        _stayId: string,
        _salesOrderId: string,
        _employeeId: string,
        _damageAmount: number,
        itemName: string,
        _roomNumber: string
    ) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('resolve_loaned_item', {
                p_loan_id: itemId,
                p_status: newStatus,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'No se pudo actualizar el artículo');

            showFeedback(
                newStatus === 'RECUPERADO' ? 'Recuperado' : 'Faltante Reportado',
                newStatus === 'RECUPERADO'
                    ? `${itemName} marcado como recuperado.`
                    : `${itemName} reportado a recepción. Ella decide si se cobra.`,
                newStatus === 'RECUPERADO' ? 'success' : 'warning'
            );

            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error updating loaned item:', error);
            showFeedback('Error', error?.message || 'No se pudo actualizar el estado del artículo.', 'error');
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
