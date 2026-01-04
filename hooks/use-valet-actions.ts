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
            const { error: stayError } = await supabase
                .from('room_stays')
                .update({
                    vehicle_plate: vehicleData.plate.trim().toUpperCase(),
                    vehicle_brand: vehicleData.brand.trim(),
                    vehicle_model: vehicleData.model.trim(),
                    valet_employee_id: valetId,
                    current_people: personCount,
                    total_people: Math.max(personCount, activeStay.total_people || 0),
                    vehicle_requested_at: null // Limpiar cualquier solicitud previa o estado inválido
                })
                .eq('id', activeStay.id);

            if (stayError) {
                console.error('Error updating room stay:', stayError);
                throw stayError;
            }

            // 2. Obtener shift actual del valet
            const { data: session } = await supabase
                .from('shift_sessions')
                .select('id')
                .eq('employee_id', valetId)
                .eq('status', 'open')
                .maybeSingle();

            // 3. Registrar pago como COBRADO_POR_VALET
            const { error: paymentError } = await supabase
                .from('payments')
                .insert({
                    sales_order_id: activeStay.sales_order_id,
                    amount: paymentData.amount,
                    payment_method: paymentData.method,
                    reference: paymentData.reference || null,
                    status: 'COBRADO_POR_VALET',
                    concept: 'HABITACION',
                    payment_type: 'COMPLETO',
                    collected_by: valetId,
                    collected_at: new Date().toISOString(),
                    shift_session_id: session?.id || null
                });

            if (paymentError) {
                console.error('Error creating payment:', paymentError);
                throw paymentError;
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

    return {
        loading,
        handleRegisterVehicleAndPayment,
        handleConfirmCheckout
    };
}
