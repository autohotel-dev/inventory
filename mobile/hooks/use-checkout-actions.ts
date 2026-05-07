import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api/client';
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
            const { data: updated } = await apiClient.post('/system/rpc/claim_checkout_valet', {
                p_stay_id: stayId,
                p_valet_id: valetId,
                p_person_count: personCount
            });

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
                const { data: emps } = await apiClient.get('/system/crud/employees', {
                    params: {
                        select: 'first_name',
                        id: `eq.${valetId}`,
                        limit: 1
                    }
                });
                const emp = emps?.[0];
                if (emp?.first_name) valetName = emp.first_name;
            } catch { /* fallback */ }

            // Notificar a recepcionistas activos (no-crítico)
            try {
                const { data: receptionSessions } = await apiClient.get('/system/crud/shift_sessions', {
                    params: {
                        select: 'employees!inner(auth_user_id,role)',
                        status: 'eq.active',
                        'employees.role': 'in.(receptionist,admin,supervisor,gerente)'
                    }
                });

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
                        await apiClient.post('/system/crud/notifications', notifications);
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
            const { data: updated } = await apiClient.post('/system/rpc/propose_checkout_valet', {
                p_stay_id: stayId,
                p_valet_id: valetId,
                p_payments: payments
            });

            if (!updated) {
                showFeedback('Ya asignada', 'Esta salida ya fue avisada por otro cochero', 'error');
                await onRefresh();
                return false;
            }

            // Obtener nombre del cochero
            let valetName = 'Cochero';
            try {
                const { data: emps } = await apiClient.get('/system/crud/employees', {
                    params: { select: 'first_name', id: `eq.${valetId}`, limit: 1 }
                });
                const emp = emps?.[0];
                if (emp?.first_name) valetName = emp.first_name;
            } catch { /* fallback */ }

            // Notificar a recepcionistas activos
            const { data: receptionSessions } = await apiClient.get('/system/crud/shift_sessions', {
                params: {
                    select: 'employees!inner(auth_user_id,role)',
                    status: 'eq.active',
                    'employees.role': 'in.(receptionist,admin,supervisor,gerente)'
                }
            });

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
                    await apiClient.post('/system/crud/notifications', notifications);
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
            const { data: sessions } = await apiClient.get('/system/crud/shift_sessions', {
                params: {
                    employee_id: `eq.${valetId}`,
                    status: 'eq.active',
                    limit: 1
                }
            });
            const session = sessions?.[0];

            const { data: items } = await apiClient.post('/system/crud/sales_order_items', [{
                    sales_order_id: salesOrderId,
                    concept_type: 'DAMAGE_CHARGE',
                    description: `DAÑO: ${description}`,
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                }]);
            const item = items?.[0];

            for (const p of payments) {
                await apiClient.post('/system/crud/payments', [{
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
                }]);
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
            const { data: sessions } = await apiClient.get('/system/crud/shift_sessions', {
                params: {
                    employee_id: `eq.${valetId}`,
                    status: 'eq.active',
                    limit: 1
                }
            });
            const session = sessions?.[0];

            const { data: items } = await apiClient.post('/system/crud/sales_order_items', [{
                    sales_order_id: salesOrderId,
                    concept_type: 'EXTRA_HOUR',
                    description: 'HORA EXTRA (COCHERO)',
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                }]);
            const item = items?.[0];

            for (const p of payments) {
                await apiClient.post('/system/crud/payments', [{
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
                }]);
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
            const { data: sessions } = await apiClient.get('/system/crud/shift_sessions', {
                params: {
                    employee_id: `eq.${valetId}`,
                    status: 'eq.active',
                    limit: 1
                }
            });
            const session = sessions?.[0];

            const { data: items } = await apiClient.post('/system/crud/sales_order_items', [{
                    sales_order_id: salesOrderId,
                    concept_type: 'EXTRA_PERSON',
                    description: 'PERSONA EXTRA (COCHERO)',
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                }]);
            const item = items?.[0];

            for (const p of payments) {
                await apiClient.post('/system/crud/payments', [{
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
                }]);
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
            const { data } = await apiClient.post('/system/rpc/verify_asset_presence', {
                p_room_id: roomId,
                p_asset_type: assetType,
                p_is_present: isPresent,
                p_employee_id: employeeId
            });
            
            if (data?.success) {
                // Notificar a recepción si no está
                if (!isPresent) {
                    const { data: receptionSessions } = await apiClient.get('/system/crud/shift_sessions', {
                        params: {
                            select: 'employees!inner(auth_user_id,role)',
                            status: 'eq.active',
                            'employees.role': 'in.(receptionist,admin,supervisor,gerente)'
                        }
                    });

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
                            await apiClient.post('/system/crud/notifications', notifications);
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

    return {
        loading,
        handleConfirmCheckout,
        handleProposeCheckout,
        handleReportDamage,
        handleRegisterExtraHour,
        handleRegisterExtraPerson,
        handleVerifyAssetPresence
    };
}
