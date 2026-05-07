import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api/client';
import { useFeedback } from '../contexts/feedback-context';
import { PaymentEntry } from '../lib/payment-types';
import { SalesOrderItem } from '../lib/types';

export function useConsumptionActions(onRefresh: () => Promise<void>) {
    const [loading, setLoading] = useState(false);
    const { showFeedback } = useFeedback();

    const handleAcceptConsumption = useCallback(async (consumptionId: string, roomNumber: string, valetId: string) => {
        setLoading(true);
        try {
            const { data: items } = await apiClient.get('/system/crud/sales_order_items', {
                params: {
                    select: 'delivery_accepted_by',
                    id: `eq.${consumptionId}`,
                    limit: 1
                }
            });
            const item = items?.[0];

            if (item?.delivery_accepted_by && item.delivery_accepted_by !== valetId) {
                showFeedback('Ya asignada', 'Este servicio ya fue aceptado por otro cochero', 'error');
                return false;
            }

            await apiClient.patch(`/system/crud/sales_order_items/${consumptionId}`, {
                delivery_accepted_by: valetId,
                delivery_accepted_at: new Date().toISOString(),
                delivery_status: 'ACCEPTED'
            });
            showFeedback('¡Éxito!', `Entrega asignada para Hab. ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error accepting consumption:", error);
            showFeedback('Error', 'Error al aceptar el consumo', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleAcceptAllConsumptions = useCallback(async (items: any[], roomNumber: string, valetId: string) => {
        if (items.length === 0) return false;
        setLoading(true);
        try {
            const itemIds = items.map(item => item.id);

            const { data: existingItems } = await apiClient.get('/system/crud/sales_order_items', {
                params: {
                    select: 'id,delivery_accepted_by',
                    id: `in.(${itemIds.join(',')})`
                }
            });

            const alreadyAccepted = existingItems?.find((item: any) => item.delivery_accepted_by && item.delivery_accepted_by !== valetId);
            if (alreadyAccepted) {
                showFeedback('Ya asignada', 'Uno o más servicios ya fueron aceptados por otro cochero', 'error');
                return false;
            }

            // Bulk update not directly supported by generic patch /id, 
            // but we can loop or use a specialized endpoint if needed.
            // For now, doing it sequentially as itemIds shouldn't be huge
            await Promise.all(itemIds.map(id => 
                apiClient.patch(`/system/crud/sales_order_items/${id}`, {
                    delivery_accepted_by: valetId,
                    delivery_accepted_at: new Date().toISOString(),
                    delivery_status: 'ACCEPTED'
                })
            ));
            showFeedback('¡Éxito!', `${items.length} entregas asignadas para Hab. ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error accepting all:", error);
            showFeedback('Error', 'Error al aceptar los servicios', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const getPaymentConcept = (itemConceptType: string | undefined): string => {
        switch (itemConceptType) {
            case 'EXTRA_HOUR': return 'HORA_EXTRA';
            case 'EXTRA_PERSON': return 'PERSONA_EXTRA';
            case 'ROOM_BASE': return 'ESTANCIA';
            case 'DAMAGE_CHARGE': return 'DAMAGE_CHARGE';
            case 'TOLERANCE_EXPIRED': return 'TOLERANCIA_EXPIRADA';
            case 'RENEWAL': return 'RENEWAL';
            default: return 'CONSUMPTION';
        }
    };

    const handleConfirmDelivery = useCallback(async (
        consumptionId: string,
        roomNumber: string,
        payments: PaymentEntry[],
        notes?: string,
        valetId?: string
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

            await apiClient.patch(`/system/crud/sales_order_items/${consumptionId}`, {
                delivery_status: 'DELIVERED',
                delivery_completed_at: new Date().toISOString(),
                delivery_notes: notes || null,
                is_paid: false
            });

            const { data: itemDataArr } = await apiClient.get('/system/crud/sales_order_items', {
                params: { select: 'sales_order_id,concept_type', id: `eq.${consumptionId}`, limit: 1 }
            });
            const itemData = itemDataArr?.[0];
            
            const salesOrderId = itemData?.sales_order_id;
            const itemConceptType = itemData?.concept_type;

            if (!salesOrderId) throw new Error("No se encontró la orden de venta asociada.");

            const paymentConcept = getPaymentConcept(itemConceptType);

            for (const p of payments) {
                // Intentar buscar un pago PENDIENTE de la misma orden y monto
                const { data: existingPendings } = await apiClient.get('/system/crud/payments', {
                    params: {
                        select: 'id',
                        sales_order_id: `eq.${salesOrderId}`,
                        status: 'eq.PENDIENTE',
                        amount: `eq.${p.amount}`,
                        limit: 1
                    }
                });
                const existingPending = existingPendings?.[0];

                if (existingPending) {
                    await apiClient.patch(`/system/crud/payments/${existingPending.id}`, {
                        payment_method: p.method,
                        terminal_code: p.terminal,
                        card_last_4: p.cardLast4,
                        card_type: p.cardType,
                        reference: p.reference || `VALET_ITEM:${consumptionId}`,
                        status: 'COBRADO_POR_VALET',
                        collected_by: valetId,
                        collected_at: new Date().toISOString(),
                        shift_session_id: session?.id || null,
                    });
                } else {
                    await apiClient.post('/system/crud/payments', [{
                        sales_order_id: salesOrderId,
                        amount: p.amount,
                        payment_method: p.method,
                        terminal_code: p.terminal,
                        card_last_4: p.cardLast4,
                        card_type: p.cardType,
                        reference: p.reference || `VALET_ITEM:${consumptionId}`,
                        concept: paymentConcept,
                        status: 'COBRADO_POR_VALET',
                        collected_by: valetId,
                        collected_at: new Date().toISOString(),
                        shift_session_id: session?.id || null,
                    }]);
                }
            }

            showFeedback('✅ Entrega Informada', `Hab. ${roomNumber}: Lleva el cobro a recepción para corroborar.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error confirming delivery:", error);
            showFeedback('Error', 'Error al confirmar la entrega', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleConfirmAllDeliveries = useCallback(async (
        items: any[],
        roomNumber: string,
        payments: PaymentEntry[],
        notes?: string,
        valetId?: string
    ) => {
        if (items.length === 0) return false;
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

            const itemIds = items.map(item => item.id);
            const salesOrderIds = [...new Set(items.map(i => i.sales_order_id))];

            await Promise.all(itemIds.map(id => 
                apiClient.patch(`/system/crud/sales_order_items/${id}`, {
                    delivery_status: 'DELIVERED',
                    delivery_completed_at: new Date().toISOString(),
                    delivery_notes: notes || null,
                    is_paid: false
                })
            ));

            const mainOrderId = salesOrderIds[0];
            const itemsRef = itemIds.length > 1 ? `VALET_BATCH:${itemIds.length}` : `VALET_ITEM:${itemIds[0]}`;
            // Use the first item's concept to determine the payment concept. Assuming batch is of the same type.
            const paymentConcept = getPaymentConcept(items[0]?.concept_type);

            for (const p of payments) {
                const { data: existingPendings } = await apiClient.get('/system/crud/payments', {
                    params: {
                        select: 'id',
                        sales_order_id: `eq.${mainOrderId}`,
                        status: 'eq.PENDIENTE',
                        amount: `eq.${p.amount}`,
                        limit: 1
                    }
                });
                const existingPending = existingPendings?.[0];

                if (existingPending) {
                    await apiClient.patch(`/system/crud/payments/${existingPending.id}`, {
                        payment_method: p.method,
                        terminal_code: p.terminal,
                        card_last_4: p.cardLast4,
                        card_type: p.cardType,
                        reference: p.reference || itemsRef,
                        status: 'COBRADO_POR_VALET',
                        collected_by: valetId,
                        collected_at: new Date().toISOString(),
                        shift_session_id: session?.id || null,
                    });
                } else {
                    await apiClient.post('/system/crud/payments', [{
                        sales_order_id: mainOrderId,
                        amount: p.amount,
                        payment_method: p.method,
                        terminal_code: p.terminal,
                        card_last_4: p.cardLast4,
                        card_type: p.cardType,
                        reference: p.reference || itemsRef,
                        concept: paymentConcept,
                        status: 'COBRADO_POR_VALET',
                        collected_by: valetId,
                        collected_at: new Date().toISOString(),
                        shift_session_id: session?.id || null,
                    }]);
                }
            }

            showFeedback('✅ Entregas Informadas', `Hab. ${roomNumber}: ${items.length} servicios informados. Corrobora los cobros en recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error confirming all deliveries:", error);
            showFeedback('Error', 'Error al confirmar las entregas', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleCancelConsumption = useCallback(async (consumptionId: string) => {
        setLoading(true);
        try {
            await apiClient.patch(`/system/crud/sales_order_items/${consumptionId}`, {
                delivery_status: 'CANCELLED',
                cancellation_reason: 'Cancelado desde app móvil'
            });
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error cancelling:", error);
            showFeedback('Error', 'Error al cancelar', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleAcceptVerification = useCallback(async (items: SalesOrderItem[], roomNumber: string, valetId: string) => {
        if (items.length === 0) return false;
        setLoading(true);
        try {
            const itemIds = items.map(item => item.id);

            const { data: existingItems } = await apiClient.get('/system/crud/sales_order_items', {
                params: {
                    select: 'id,delivery_accepted_by',
                    id: `in.(${itemIds.join(',')})`
                }
            });

            const alreadyAccepted = existingItems?.find((item: any) => item.delivery_accepted_by && item.delivery_accepted_by !== valetId);
            if (alreadyAccepted) {
                showFeedback('Ya asignada', 'Esta verificación ya fue aceptada por otro cochero', 'error');
                return false;
            }

            await Promise.all(itemIds.map(id => 
                apiClient.patch(`/system/crud/sales_order_items/${id}`, {
                    delivery_accepted_by: valetId,
                    delivery_accepted_at: new Date().toISOString(),
                    delivery_status: 'ACCEPTED'
                })
            ));
            showFeedback('¡En Camino! 🫡', `Has aceptado verificar la Hab. ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error("Error accepting verification:", error);
            showFeedback('Error', 'Error al aceptar la verificación', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    return {
        loading,
        handleAcceptConsumption,
        handleAcceptAllConsumptions,
        handleAcceptVerification,
        handleConfirmDelivery,
        handleConfirmAllDeliveries,
        handleCancelConsumption,
    };
}
