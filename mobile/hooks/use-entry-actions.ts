import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api/client';
import { useFeedback } from '../contexts/feedback-context';
import { PaymentEntry } from '../lib/payment-types';
import { SyncQueue } from '../lib/sync-queue';

interface VehicleData {
    plate: string;
    brand: string;
    model: string;
}

export function useEntryActions(onRefresh: () => Promise<void>) {
    const [loading, setLoading] = useState(false);
    const { showFeedback } = useFeedback();

    const handleAcceptEntry = useCallback(async (stayId: string, roomNumber: string, valetId: string) => {
        setLoading(true);
        try {
            // Intento 1: ¿Estamos Offline? Encolarlo.
            const isEnqueued = await SyncQueue.enqueue({
                type: 'UPDATE',
                table: 'room_stays',
                payload: { valet_employee_id: valetId },
                matchCriteria: { id: stayId }
            });

            if (isEnqueued) {
                showFeedback('Offline', `Asignación guardada. Se subirá al recuperar conexión.`, 'info');
                await onRefresh();
                return true;
            }

            // UPDATE atómico via RPC
            const { data: updated } = await apiClient.post('/system/rpc/claim_entry_valet', {
                p_stay_id: stayId,
                p_valet_id: valetId
            });

            if (!updated) {
                showFeedback('Ya asignada', 'Esta entrada ya fue aceptada por otro cochero', 'error');
                await onRefresh();
                return false;
            }

            showFeedback('¡Éxito!', `Te has asignado la Habitación ${roomNumber}`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error accepting entry:', error);
            showFeedback('Error', error.message || 'Error al aceptar la entrada', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleRegisterVehicleAndPayment = useCallback(async (
        stayId: string,
        salesOrderId: string,
        roomNumber: string,
        vehicleData: VehicleData,
        payments: PaymentEntry[],
        valetId: string,
        personCount: number,
        totalPeople?: number,
        extraPersonPrice?: number
    ) => {
        setLoading(true);
        
        console.log('🔍 MOBILE DEBUG: Iniciando handleRegisterVehicleAndPayment');
        console.log('  - valetId recibido:', valetId);
        console.log('  - roomNumber:', roomNumber);
        console.log('  - personCount:', personCount);
        console.log('  - extraPersonPrice:', extraPersonPrice);
        console.log('  - payments:', payments);

        try {
            // --- 1. Actualizar room_stay con datos del vehículo ---
            await apiClient.patch(`/system/crud/room_stays/${stayId}`, {
                vehicle_plate: vehicleData.plate.trim().toUpperCase(),
                vehicle_brand: vehicleData.brand.trim(),
                vehicle_model: vehicleData.model.trim(),
                valet_employee_id: valetId,
                current_people: personCount,
                total_people: Math.max(personCount, totalPeople || 0),
                vehicle_requested_at: null,
                valet_checkout_requested_at: null,
                checkout_payment_data: payments.map(p => ({
                    amount: p.amount,
                    method: p.method,
                    reference: p.reference,
                    terminal: p.terminal,
                    cardType: p.cardType,
                    cardLast4: p.cardLast4,
                    concept: 'ENTRADA'
                }))
            });

            // --- 2. Obtener sesión activa ---
            const { data: sessions } = await apiClient.get('/system/crud/shift_sessions', {
                params: {
                    employee_id: `eq.${valetId}`,
                    status: 'eq.active',
                    limit: 1
                }
            });
            const session = sessions?.[0];

            // --- 3. Buscar pago pendiente de ESTANCIA ---
            const { data: pendingMains } = await apiClient.get('/system/crud/payments', {
                params: {
                    select: 'id,amount',
                    sales_order_id: `eq.${salesOrderId}`,
                    concept: 'eq.ESTANCIA',
                    status: 'eq.PENDIENTE',
                    parent_payment_id: 'is.null',
                    order: 'created_at.asc',
                    limit: 1
                }
            });
            const pendingMain = pendingMains?.[0];

            if (!pendingMain?.id) {
                showFeedback('Sin pago pendiente', 'No se encontró el cargo de la estancia.', 'warning');
                return false;
            }

            // --- 4. Procesar pagos del cochero (ESTANCIA) ---
            console.log('🔍 MOBILE DEBUG: Guardando pagos del cochero');
            
            for (let i = 0; i < payments.length; i++) {
                const p = payments[i];
                console.log(`  - Payment ${i}: $${p.amount} - ${p.method}`);
                
                if (i === 0) {
                    await apiClient.patch(`/system/crud/payments/${pendingMain.id}`, {
                        amount: p.amount,
                        payment_method: p.method,
                        terminal_code: p.terminal,
                        card_last_4: p.cardLast4,
                        card_type: p.cardType,
                        reference: p.reference || null,
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
                        reference: p.reference || null,
                        concept: 'ESTANCIA',
                        status: 'COBRADO_POR_VALET',
                        payment_type: 'PARCIAL',
                        parent_payment_id: pendingMain.id,
                        collected_by: valetId,
                        collected_at: new Date().toISOString(),
                        shift_session_id: session?.id || null,
                    }]);
                }
            }

            // --- 5. REQ-02: Generar conceptos EXTRA_PERSON si hay más de 2 personas ---
            const extraCount = Math.max(0, personCount - 2);
            if (extraCount > 0 && extraPersonPrice && extraPersonPrice > 0) {
                console.log(`📦 Generando ${extraCount} conceptos EXTRA_PERSON a $${extraPersonPrice} c/u`);

                // Obtener product_id de servicio (el mismo que usa ROOM_BASE)
                const { data: existingItems } = await apiClient.get('/system/crud/sales_order_items', {
                    params: {
                        select: 'product_id',
                        sales_order_id: `eq.${salesOrderId}`,
                        concept_type: 'eq.ROOM_BASE',
                        limit: 1
                    }
                });
                const existingItem = existingItems?.[0];

                const serviceProductId = existingItem?.product_id;
                if (!serviceProductId) {
                    console.warn('No se encontró product_id de ROOM_BASE, omitiendo items de persona extra');
                } else {
                    for (let i = 0; i < extraCount; i++) {
                        // Crear sales_order_item
                        try {
                            await apiClient.post('/system/crud/sales_order_items', [{
                                sales_order_id: salesOrderId,
                                product_id: serviceProductId,
                                qty: 1,
                                unit_price: extraPersonPrice,
                                concept_type: 'EXTRA_PERSON',
                                is_paid: false,
                                delivery_status: 'DELIVERED', // Ya está en la habitación
                            }]);
                        } catch (itemErr) {
                            console.error(`Error creating EXTRA_PERSON item ${i + 1}:`, itemErr);
                        }

                        // Crear pago PENDIENTE por persona extra
                        try {
                            await apiClient.post('/system/crud/payments', [{
                                sales_order_id: salesOrderId,
                                amount: extraPersonPrice,
                                payment_method: 'PENDIENTE',
                                concept: 'PERSONA_EXTRA',
                                status: 'PENDIENTE',
                                payment_type: 'COMPLETO',
                                shift_session_id: session?.id || null,
                            }]);
                        } catch (payErr) {
                            console.error(`Error creating PERSONA_EXTRA payment ${i + 1}:`, payErr);
                        }
                    }

                    // Actualizar totales de la sales_order
                    const extraTotal = extraCount * extraPersonPrice;
                    const { data: currentOrder } = await apiClient.get(`/system/crud/sales_orders/${salesOrderId}`, {
                        params: { select: 'total,remaining_amount' }
                    });

                    if (currentOrder) {
                        await apiClient.patch(`/system/crud/sales_orders/${salesOrderId}`, {
                            total: (currentOrder.total || 0) + extraTotal,
                            remaining_amount: (currentOrder.remaining_amount || 0) + extraTotal,
                        });
                    }

                    console.log(`✅ ${extraCount} conceptos EXTRA_PERSON creados exitosamente`);
                }
            }

            showFeedback('Entrada registrada', `Hab. ${roomNumber}: Lleva el dinero/vouchers a recepción.`);
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error registering vehicle and payment:', error);
            showFeedback('Error', error.message || 'Error al registrar entrada', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    const handleConfirmTvOn = useCallback(async (
        roomId: string,
        employeeId: string
    ) => {
        setLoading(true);
        try {
            const { data } = await apiClient.post('/system/rpc/confirm_tv_on', {
                p_room_id: roomId,
                p_employee_id: employeeId
            });

            if (data?.success) {
                showFeedback('TV Encendida', data.message || 'Televisión confirmada como encendida');
                await onRefresh();
                return true;
            } else {
                showFeedback('Aviso', data.message || 'No se pudo actualizar el activo', 'warning');
                return false;
            }
        } catch (error: any) {
            console.error('Error dropping asset in room:', error);
            showFeedback('Error', 'Hubo un error al marcar el control', 'error');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh, showFeedback]);

    return {
        loading,
        handleAcceptEntry,
        handleRegisterVehicleAndPayment,
        handleConfirmTvOn
    };
}
