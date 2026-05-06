import { apiClient } from "@/lib/api/client";
import { useState, useCallback } from 'react';

import { toast } from 'sonner';
import { Room } from '@/components/sales/room-types';
import { findActiveFlow, logFlowEvent } from '@/lib/flow-logger';

/** Lightweight payment entry for valet operations (no id needed) */
interface ValetPaymentEntry {
    amount: number;
    method: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
    terminal?: string;
    cardLast4?: string;
    cardType?: string;
    reference?: string;
}

interface VehicleData {
    plate: string;
    brand: string;
    model: string;
}

export function useValetActions(onRefresh: () => Promise<void>) {
    const [loading, setLoading] = useState(false);

    /**
     * Registrar vehículo y cobro para entrada
     * 
     * Flujo:
     * 1. Actualizar room_stay con datos de vehículo
     * 2. Auto-asignar valet_employee_id
     * 3. Crear payment con status 'COBRADO_POR_VALET'
     * 4. Notificar recepción para confirmación
     */
    const handleRegisterVehicleAndPayment = useCallback(async (
        room: Room,
        vehicleData: VehicleData,
        payments: ValetPaymentEntry[],
        valetId: string,
        personCount: number
    ) => {
        setLoading(true);

        try {
            // Obtener estancia activa
            const activeStay = room.room_stays?.find(s => s.status === 'ACTIVA');
            if (!activeStay) {
                toast.error('No se encontró estancia activa');
                return false;
            }

            // 1. Verificar que no esté asignada a otro cochero
            const { data: currentStay } = await apiClient.get(`/system/crud/room_stays/${activeStay.id}`) as any;
            
            if (currentStay.valet_employee_id && currentStay.valet_employee_id !== valetId) {
                toast.warning('Entrada ya asignada', {
                    description: 'Otro cochero ya aceptó esta entrada.'
                });
                return false;
            }

            // 2. Actualizar vehículo y asignar valet (sin usar .or para evitar el bug de Supabase)
            await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {
                    vehicle_plate: vehicleData.plate.trim().toUpperCase(),
                    vehicle_brand: vehicleData.brand.trim(),
                    vehicle_model: vehicleData.model.trim(),
                    valet_employee_id: valetId,
                    current_people: personCount,
                    total_people: Math.max(personCount, activeStay.total_people || 0),
                    vehicle_requested_at: null,
                    checkout_payment_data: payments.map(p => ({
                        amount: p.amount,
                        method: p.method,
                        reference: p.reference,
                        concept: 'ENTRADA'
                    }))
                });

            // 2. Obtener shift actual del valet (estado 'active' para consistencia con móvil)
            const { data: authData } = await apiClient.get('/system/auth/me') as any;
            const session = authData?.session;

            // 3. Tomar el pago principal creado por recepción (ESTANCIA, PENDIENTE)
            const { data: pendingMains } = await apiClient.get('/system/crud/payments', { params: { sales_order_id: activeStay.sales_order_id, status: 'PENDIENTE', parent_payment_id: 'null' } }) as any;
            const pendingMain = pendingMains && pendingMains.length > 0 ? pendingMains[0] : null;

            if (!pendingMain?.id) {
                toast.error('No se encontró el cargo de la estancia', {
                    description: 'Pide a recepción que valide el cargo de la habitación.'
                });
                return false;
            }

            // 4. Registrar los pagos
            for (let i = 0; i < payments.length; i++) {
                const p = payments[i];
                if (i === 0) {
                    // El primero actualiza el registro principal
                    await apiClient.post(`/system/crud/payments`, { /* update placeholder */
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
                    // Los demás se insertan como parciales vinculados
                    await apiClient.post(`/system/crud/payments`, {
                        sales_order_id: activeStay.sales_order_id,
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
                    });
                }
            }

            toast.success('✅ Entrada registrada', {
                description: `Hab. ${room.number}: Entrega dinero/vouchers en recepción.`,
                duration: 5000
            });

            // ─── Flow Event ─────────────────────────────────────────────
            if (activeStay) {
                findActiveFlow(activeStay.id).then(flowId => {
                    if (flowId) {
                        logFlowEvent(flowId, {
                            event_type: 'VALET_VEHICLE_REGISTERED',
                            description: `Vehículo registrado: ${vehicleData.plate} ${vehicleData.brand} ${vehicleData.model}`,
                            metadata: { plate: vehicleData.plate, brand: vehicleData.brand, model: vehicleData.model, person_count: personCount },
                        });
                        logFlowEvent(flowId, {
                            event_type: 'VALET_PAYMENT_COLLECTED',
                            description: `Cobro por cochero: ${payments.length} pago(s)`,
                            metadata: { payments: payments.map(p => ({ amount: p.amount, method: p.method })) },
                        });
                    }
                });
            }

            await onRefresh();
            return true;

        } catch (error) {
            console.error('Error registering vehicle and payment:', error);
            toast.error('Error al registrar entrada');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    /**
     * Confirmar salida después de revisión
     * 
     * Flujo:
     * 1. Asignar checkout_valet_employee_id
     * 2. Permitir que recepción finalice checkout
     */
    const handleConfirmCheckout = useCallback(async (room: Room, valetId: string, personCount: number) => {
        setLoading(true);

        try {
            const activeStay = room.room_stays?.find(s => s.status === 'ACTIVA');
            if (!activeStay) {
                toast.error('No se encontró estancia activa');
                return false;
            }

            // Asignar cochero de salida
            await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {
                    checkout_valet_employee_id: valetId,
                    current_people: personCount
                });

            toast.success('✅ Habitación revisada', {
                description: `Hab. ${room.number}: Todo en orden, lista para salida`
            });

            await onRefresh();
            return true;

        } catch (error) {
            console.error('Error confirming checkout:', error);
            toast.error('Error al confirmar salida');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    /**
     * Proponer salida (desde el cochero)
     * 
     * Flujo:
     * 1. Registrar timestamp de propuesta
     * 2. Notificar a recepción para autorización
     */
    const handleProposeCheckout = useCallback(async (room: Room, valetId: string) => {
        setLoading(true);

        try {
            const activeStay = room.room_stays?.find(s => s.status === 'ACTIVA');
            if (!activeStay) {
                toast.error('No se encontró estancia activa');
                return false;
            }

            await apiClient.patch(`/system/crud/room_stays/${activeStay.id}`, {
                    valet_checkout_requested_at: new Date().toISOString(),
                    valet_employee_id: activeStay.valet_employee_id || valetId
                }); toast.success('✅ Salida notificada', {
                description: `Hab. ${room.number}: Esperando autorización de recepción`
            });

            await onRefresh();
            return true;
        } catch (error) {
            console.error('Error proposing checkout:', error);
            toast.error('Error al notificar la salida');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    /**
     * Aceptar una entrada (asignar valet a la estancia)
     */
    const handleAcceptEntry = useCallback(async (stayId: string, roomNumber: string, valetId: string) => {
        setLoading(true);
        try {
            await apiClient.patch(`/system/crud/room_stays/${stayId}`, { valet_employee_id: valetId });

            toast.success('¡Éxito!', {
                description: `Te has asignado la Habitación ${roomNumber}`
            });

            // ─── Flow Event ─────────────────────────────────────────────
            findActiveFlow(stayId).then(flowId => {
                if (flowId) {
                    logFlowEvent(flowId, {
                        event_type: 'VALET_ENTRY_ACCEPTED',
                        description: `Cochero aceptó la entrada de Hab. ${roomNumber}`,
                        metadata: { room_number: roomNumber },
                    });
                }
            });

            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error accepting entry:', error);
            toast.error('Error al aceptar la entrada');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    /**
     * Aceptar consumo para entregar
     */
    const handleAcceptConsumption = useCallback(async (consumptionId: string, roomNumber: string, valetId: string) => {
        setLoading(true);
        try {
            await apiClient.patch(`/system/crud/sales_order_items/${consumptionId}`, {
                    delivery_accepted_by: valetId,
                    delivery_accepted_at: new Date().toISOString(),
                    delivery_status: 'ACCEPTED'
                });
            toast.success('¡Éxito!', {
                description: `Entrega asignada para Hab. ${roomNumber}`
            });
            await onRefresh();
            return true;
        } catch (err) {
            console.error("Error accepting consumption:", err);
            toast.error('Error al aceptar el consumo');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    /**
     * Aceptar TODOS los consumos de una habitación
     */
    const handleAcceptAllConsumptions = useCallback(async (items: any[], roomNumber: string, valetId: string) => {
        if (items.length === 0) return false;
        setLoading(true);
        try {
            const itemIds = items.map(item => item.id);
            await Promise.all(itemIds.map(id => apiClient.patch(`/system/crud/sales_order_items/${id}`, {
                    delivery_accepted_by: valetId,
                    delivery_accepted_at: new Date().toISOString(),
                    delivery_status: 'ACCEPTED'
                })));
            toast.success('¡Éxito!', {
                description: `${items.length} entregas asignadas para Hab. ${roomNumber}`
            });
            await onRefresh();
            return true;
        } catch (err) {
            console.error("Error accepting all:", err);
            toast.error('Error al aceptar los servicios');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    /**
     * Confirmar entrega de un consumo y registrar cobro
     */
    const handleConfirmDelivery = useCallback(async (
        consumptionId: string,
        roomNumber: string,
        payments: ValetPaymentEntry[],
        notes: string | undefined,
        valetId: string,
        tipAmount?: number,
        tipMethod?: 'EFECTIVO' | 'TARJETA'
    ) => {
        setLoading(true);
        try {
            // 1. Obtener shift actual
            const { data: authData } = await apiClient.get('/system/auth/me') as any;
            const session = authData?.session;

            // 2. Obtener sales_order_id
            const { data: itemData } = await apiClient.get(`/system/crud/sales_order_items/${consumptionId}`) as any;

            // 3. Actualizar item
            const updateData: any = {
                delivery_status: 'DELIVERED',
                delivery_completed_at: new Date().toISOString(),
                delivery_notes: notes || null,
                is_paid: false // Reception will mark as paid when confirming valet payment
            };

            if (tipAmount && tipAmount > 0) {
                updateData.tip_amount = tipAmount;
                updateData.tip_method = tipMethod;
            }

            await apiClient.patch(`/system/crud/sales_order_items/${consumptionId}`, updateData);

            // 4. Registrar pagos
            for (const p of payments) {
                await apiClient.post(`/system/crud/payments`, {
                    sales_order_id: itemData.sales_order_id,
                    amount: p.amount,
                    payment_method: p.method,
                    terminal_code: p.terminal,
                    card_last_4: p.cardLast4,
                    card_type: p.cardType,
                    reference: p.reference || `VALET_ITEM:${consumptionId}`,
                    concept: 'CONSUMPTION',
                    status: 'COBRADO_POR_VALET',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                });
            }

            toast.success('✅ Entrega Informada', {
                description: `Hab. ${roomNumber}: Lleva el cobro a recepción para corroborar.`
            });

            // ─── Flow Event ─────────────────────────────────────────────
            const { data: itemFull } = await apiClient.get(`/system/crud/sales_order_items/${consumptionId}`) as any;
            const { data: orders } = await apiClient.get('/system/crud/room_stays', { params: { sales_order_id: itemFull.sales_order_id } }) as any;
            const itemStay = orders && orders.length > 0 ? { sales_orders: { room_stays: [{ id: orders[0].id }] } } : null;
            const stayIdForFlow = (itemStay as any)?.sales_orders?.room_stays?.[0]?.id;
            if (stayIdForFlow) {
                findActiveFlow(stayIdForFlow).then(flowId => {
                    if (flowId) {
                        logFlowEvent(flowId, {
                            event_type: 'CONSUMPTION_DELIVERED',
                            description: `Consumo entregado en Hab. ${roomNumber}`,
                            metadata: { consumption_id: consumptionId, tip_amount: tipAmount },
                        });
                    }
                });
            }

            await onRefresh();
            return true;
        } catch (err) {
            console.error("Error confirming delivery:", err);
            toast.error('Error al confirmar la entrega');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    /**
     * Confirmar todas las entregas de una habitación y registrar cobro
     */
    const handleConfirmAllDeliveries = useCallback(async (
        items: any[],
        roomNumber: string,
        payments: ValetPaymentEntry[],
        notes: string | undefined,
        valetId: string
    ) => {
        if (items.length === 0) return false;
        setLoading(true);
        try {
            // 1. Obtener shift actual
            const { data: authData } = await apiClient.get('/system/auth/me') as any;
            const session = authData?.session;

            const itemIds = items.map(item => item.id);
            const salesOrderId = items[0].sales_order_id;

            // 2. Actualizar items
            await Promise.all(itemIds.map(id => apiClient.patch(`/system/crud/sales_order_items/${id}`, {
                    delivery_status: 'DELIVERED',
                    delivery_completed_at: new Date().toISOString(),
                    delivery_notes: notes || null,
                    is_paid: false // Reception will mark as paid when confirming valet payment
                })));

            // 3. Registrar pagos
            const itemsRef = itemIds.length > 1 ? `VALET_BATCH:${itemIds.length}` : `VALET_ITEM:${itemIds[0]}`;
            for (const p of payments) {
                await apiClient.post(`/system/crud/payments`, {
                    sales_order_id: salesOrderId,
                    amount: p.amount,
                    payment_method: p.method,
                    terminal_code: p.terminal,
                    card_last_4: p.cardLast4,
                    card_type: p.cardType,
                    reference: p.reference || itemsRef,
                    concept: 'CONSUMPTION',
                    status: 'COBRADO_POR_VALET',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                });
            }

            toast.success('✅ Entregas Informadas', {
                description: `Hab. ${roomNumber}: ${items.length} servicios informados. Corrobora los cobros en recepción.`
            });
            await onRefresh();
            return true;
        } catch (err) {
            console.error("Error confirming all deliveries:", err);
            toast.error('Error al confirmar las entregas');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    const handleCancelConsumption = useCallback(async (consumptionId: string) => {
        setLoading(true);
        try {
            await apiClient.patch(`/system/crud/sales_order_items/${consumptionId}`, {
                    delivery_status: 'CANCELLED',
                    cancellation_reason: 'Cancelado desde tablero de cochero'
                });
            toast.success("Solicitud cancelada");
            await onRefresh();
            return true;
        } catch (err) {
            console.error("Error cancelling:", err);
            toast.error("Error al cancelar");
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    /**
     * Reportar un daño encontrado durante la revisión
     */
    const handleReportDamage = useCallback(async (
        salesOrderId: string,
        roomNumber: string,
        description: string,
        amount: number,
        payments: ValetPaymentEntry[],
        valetId: string
    ) => {
        setLoading(true);
        try {
            // 1. Obtener shift actual
            const { data: authData } = await apiClient.get('/system/auth/me') as any;
            const session = authData?.session;

            // 2. Crear el cargo por daño en sales_order_items
            const { data: item } = await apiClient.post('/system/crud/sales_order_items', {
                    sales_order_id: salesOrderId,
                    concept_type: 'DAMAGE_CHARGE',
                    description: `DAÑO: ${description}`,
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                }) as any;

            // 3. Registrar los pagos
            for (const p of payments) {
                await apiClient.post(`/system/crud/payments`, {
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
            }

            toast.success('✅ Daño Informado', {
                description: `Se ha generado el cargo por $${amount.toFixed(2)}. Informa a recepción para confirmar el cobro.`
            });
            await onRefresh();
            return true;
        } catch (err) {
            console.error('Error reporting damage:', err);
            toast.error('No se pudo registrar el daño.');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    const handleRegisterExtraHour = useCallback(async (
        salesOrderId: string,
        roomNumber: string,
        amount: number,
        payments: ValetPaymentEntry[],
        valetId: string
    ) => {
        setLoading(true);
        try {
            const { data: authData } = await apiClient.get('/system/auth/me') as any;
            const session = authData?.session;

            const { data: item } = await apiClient.post('/system/crud/sales_order_items', {
                    sales_order_id: salesOrderId,
                    concept_type: 'EXTRA_HOUR',
                    description: 'HORA EXTRA (VALET)',
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                }) as any;

            for (const p of payments) {
                await apiClient.post(`/system/crud/payments`, {
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
            }

            toast.success('✅ Hora Extra Informada', {
                description: `Hab. ${roomNumber}: Cobro registrado. Entrega el dinero en recepción.`
            });
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error registering extra hour:', error);
            toast.error('No se pudo registrar la hora extra.');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    const handleRegisterExtraPerson = useCallback(async (
        salesOrderId: string,
        roomNumber: string,
        amount: number,
        payments: ValetPaymentEntry[],
        valetId: string
    ) => {
        setLoading(true);
        try {
            const { data: authData } = await apiClient.get('/system/auth/me') as any;
            const session = authData?.session;

            const { data: item } = await apiClient.post('/system/crud/sales_order_items', {
                    sales_order_id: salesOrderId,
                    concept_type: 'EXTRA_PERSON',
                    description: 'PERSONA EXTRA (VALET)',
                    unit_price: amount,
                    qty: 1,
                    total: amount,
                    is_paid: false
                }) as any;

            for (const p of payments) {
                await apiClient.post(`/system/crud/payments`, {
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
            }

            toast.success('✅ Persona Extra Informada', {
                description: `Hab. ${roomNumber}: Cobro registrado. Entrega el dinero en recepción.`
            });
            await onRefresh();
            return true;
        } catch (error: any) {
            console.error('Error registering extra person:', error);
            toast.error('No se pudo registrar la persona extra.');
            return false;
        } finally {
            setLoading(false);
        }
    }, [onRefresh]);

    return {
        loading,
        handleAcceptEntry,
        handleRegisterVehicleAndPayment,
        handleConfirmCheckout,
        handleProposeCheckout,
        handleAcceptConsumption,
        handleAcceptAllConsumptions,
        handleConfirmDelivery,
        handleConfirmAllDeliveries,
        handleCancelConsumption,
        handleReportDamage,
        handleRegisterExtraHour,
        handleRegisterExtraPerson
    };
}
