import { supabase } from './supabase';

/**
 * Criterios compartidos por Panel, badges de pestañas y Habitaciones, para que los tres
 * cuenten lo mismo.
 */
type StayFlags = {
    vehicle_plate?: string | null;
    vehicle_requested_at?: string | null;
    valet_checkout_requested_at?: string | null;
    checkout_valet_employee_id?: string | null;
};

/** Entrada pendiente: la estancia aún no tiene vehículo registrado */
export const isEntryPending = (stay?: StayFlags | null) => !!stay && !stay.vehicle_plate;

/** Urgente: piden el auto o la revisión de salida y ningún cochero la ha tomado */
export const isUrgentCheckout = (stay?: StayFlags | null) =>
    !!stay && !!(stay.vehicle_requested_at || stay.valet_checkout_requested_at) && !stay.checkout_valet_employee_id;

/** Consumos por llevar que nadie ha aceptado (la misma consulta que la pestaña Servicios) */
export async function countPendingServices(): Promise<number> {
    const { count } = await supabase
        .from('sales_order_items')
        .select('id', { count: 'exact', head: true })
        .eq('concept_type', 'CONSUMPTION')
        .is('delivery_accepted_by', null)
        .eq('is_paid', false)
        .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")');
    return count || 0;
}
