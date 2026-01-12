import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Room } from '@/components/sales/room-types';

interface VehicleData {
    plate: string;
    brand: string;
    model: string;
}

interface PaymentData {
    amount: number;
    method: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
    reference?: string;
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
    const handleRegisterVehicleAndPayment = async (
        room: Room,
        vehicleData: VehicleData,
        paymentData: PaymentData,
        valetId: string,
        personCount: number
    ) => {
        setLoading(true);
        const supabase = createClient();

        try {
            // Obtener estancia activa
            const activeStay = room.room_stays?.find(s => s.status === 'ACTIVA');
            if (!activeStay) {
                toast.error('No se encontró estancia activa');
                return false;
            }

            // 1. Actualizar vehículo y asignar valet
            // Permitir actualización si: NO tiene valet O el valet soy YO
            const { error: stayError, count } = await supabase
                .from('room_stays')
                .update({
                    vehicle_plate: vehicleData.plate.trim().toUpperCase(),
                    vehicle_brand: vehicleData.brand.trim(),
                    vehicle_model: vehicleData.model.trim(),
                    valet_employee_id: valetId,
                    current_people: personCount,
                    total_people: Math.max(personCount, activeStay.total_people || 0),
                    vehicle_requested_at: null // Limpiar cualquier solicitud previa
                })
                .eq('id', activeStay.id)
                .or(`valet_employee_id.is.null,valet_employee_id.eq.${valetId}`); // Permitir si es null O es el mismo valet

            // Verificar si la actualización afectó alguna fila
            if (stayError) {
                console.error('Error updating room stay:', stayError);
                throw stayError;
            }

            // Si count es 0, significa que otro valet ya está asignado
            if (count === 0) {
                toast.warning('Entrada ya asignada', {
                    description: 'Otro cochero ya aceptó esta entrada.'
                });
                return false;
            }

            // 2. Obtener shift actual del valet
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'open')
                .maybeSingle();

            // 3. El cochero NO crea un pago nuevo.
            // Debe tomar el pago principal creado por recepción (ESTANCIA, PENDIENTE)
            // y marcarlo como COBRADO_POR_VALET para que recepción lo confirme.
            const { data: pendingMain, error: pendingMainError } = await supabase
                .from('payments')
                .select('id')
                .eq('sales_order_id', activeStay.sales_order_id)
                .eq('concept', 'ESTANCIA')
                .eq('status', 'PENDIENTE')
                .is('parent_payment_id', null)
                .order('created_at', { ascending: true })
                .maybeSingle();

            if (pendingMainError) {
                console.error('Error finding pending main payment:', pendingMainError);
                throw pendingMainError;
            }

            if (!pendingMain?.id) {
                toast.error('No se encontró el pago pendiente de la estancia', {
                    description: 'Pide a recepción que genere/valide el cargo de la habitación antes de registrar el cobro.'
                });
                return false;
            }

            const { error: paymentUpdateError } = await supabase
                .from('payments')
                .update({
                    // Asegurar que el principal refleje el cobro real del cochero
                    amount: paymentData.amount,
                    payment_method: paymentData.method,
                    reference: paymentData.reference || null,
                    status: 'COBRADO_POR_VALET',
                    payment_type: 'COMPLETO',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null,
                })
                .eq('id', pendingMain.id);

            if (paymentUpdateError) {
                console.error('Error updating payment as COBRADO_POR_VALET:', paymentUpdateError);
                throw paymentUpdateError;
            }

            const methodLabel = paymentData.method === 'EFECTIVO' ? 'el dinero' :
                paymentData.method === 'TARJETA' ? 'el voucher' :
                    'el comprobante';

            toast.success('✅ Entrada registrada', {
                description: `Hab. ${room.number}: Lleva ${methodLabel} a recepción para confirmar`,
                duration: 5000
            });

            await onRefresh();
            return true;

        } catch (error) {
            console.error('Error registering vehicle and payment:', error);
            toast.error('Error al registrarentrada');
            return false;
        } finally {
            setLoading(false);
        }
    };

    /**
     * Confirmar salida después de revisión
     * 
     * Flujo:
     * 1. Asignar checkout_valet_employee_id
     * 2. Permitir que recepción finalice checkout
     */
    const handleConfirmCheckout = async (room: Room, valetId: string, personCount: number) => {
        setLoading(true);
        const supabase = createClient();

        try {
            const activeStay = room.room_stays?.find(s => s.status === 'ACTIVA');
            if (!activeStay) {
                toast.error('No se encontró estancia activa');
                return false;
            }

            // Asignar cochero de salida
            const { error } = await supabase
                .from('room_stays')
                .update({
                    checkout_valet_employee_id: valetId,
                    current_people: personCount
                })
                .eq('id', activeStay.id);

            if (error) {
                console.error('Error confirming checkout:', error);
                throw error;
            }

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
    };

    /**
     * Proponer salida (desde el cochero)
     * 
     * Flujo:
     * 1. Registrar timestamp de propuesta
     * 2. Notificar a recepción para autorización
     */
    const handleProposeCheckout = async (room: Room, valetId: string) => {
        setLoading(true);
        const supabase = createClient();

        try {
            const activeStay = room.room_stays?.find(s => s.status === 'ACTIVA');
            if (!activeStay) {
                toast.error('No se encontró estancia activa');
                return false;
            }

            const { error } = await supabase
                .from('room_stays')
                .update({
                    valet_checkout_requested_at: new Date().toISOString(),
                    valet_employee_id: activeStay.valet_employee_id || valetId
                })
                .eq('id', activeStay.id);

            if (error) throw error;

            toast.success('✅ Salida notificada', {
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
    };

    return {
        loading,
        handleRegisterVehicleAndPayment,
        handleConfirmCheckout,
        handleProposeCheckout
    };
}
