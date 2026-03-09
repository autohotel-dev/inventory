/**
 * Servicio para operaciones relacionadas con habitaciones
 */
import { createClient } from "@/lib/supabase/client";
import { Result, success, failure } from "@/lib/types/api";
import { ROOM_STATUS, STAY_STATUS, RoomStatus, StayStatus } from "@/lib/constants/room-constants";
import { logger } from "@/lib/utils/logger";

/**
 * Tipo para estancia de habitación
 */
export interface RoomStay {
    id: string;
    room_id: string;
    sales_order_id: string;
    status: StayStatus;
    current_people: number;
    total_people: number;
    tolerance_started_at: string | null;
    tolerance_type: string | null;
    expected_check_out_at: string | null;
    actual_check_out_at: string | null;
    created_at: string;
}

/**
 * Actualiza el estado de una habitación
 * @param roomId - ID de la habitación
 * @param status - Nuevo estado
 * @returns Resultado de la operación
 */
export async function updateRoomStatus(
    roomId: string,
    status: RoomStatus
): Promise<Result<boolean>> {
    const supabase = createClient();

    try {
        const { error } = await supabase
            .from("rooms")
            .update({ status })
            .eq("id", roomId);

        if (error) {
            logger.error("Error updating room status", { roomId, status, error });
            return failure("No se pudo actualizar el estado de la habitación", "ROOM_UPDATE_ERROR");
        }

        return success(true);
    } catch (error) {
        logger.error("Unexpected error updating room status", error);
        return failure("Error inesperado al actualizar habitación", "ROOM_UPDATE_EXCEPTION");
    }
}

/**
 * Obtiene la estancia activa de una habitación
 * @param roomId - ID de la habitación
 * @returns Resultado con la estancia activa o null si no hay ninguna
 */
export async function getActiveStay(
    roomId: string
): Promise<Result<RoomStay | null>> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("room_stays")
            .select("*")
            .eq("room_id", roomId)
            .eq("status", STAY_STATUS.ACTIVA)
            .maybeSingle();

        if (error) {
            logger.error("Error fetching active stay", { roomId, error });
            return failure("Error al obtener estancia activa", "STAY_FETCH_ERROR");
        }

        return success(data as RoomStay | null);
    } catch (error) {
        logger.error("Unexpected error fetching active stay", error);
        return failure("Error inesperado al obtener estancia", "STAY_FETCH_EXCEPTION");
    }
}

/**
 * Actualiza los datos de una estancia
 * @param stayId - ID de la estancia
 * @param updates - Datos a actualizar
 * @returns Resultado de la operación
 */
export async function updateStay(
    stayId: string,
    updates: Partial<RoomStay>
): Promise<Result<boolean>> {
    const supabase = createClient();

    try {
        const { error } = await supabase
            .from("room_stays")
            .update(updates)
            .eq("id", stayId);

        if (error) {
            logger.error("Error updating stay", { stayId, updates, error });
            return failure("Error al actualizar estancia", "STAY_UPDATE_ERROR");
        }

        return success(true);
    } catch (error) {
        logger.error("Unexpected error updating stay", error);
        return failure("Error inesperado al actualizar estancia", "STAY_UPDATE_EXCEPTION");
    }
}

/**
 * Finaliza una estancia
 * @param stayId - ID de la estancia
 * @param roomId - ID de la habitación
 * @param salesOrderId - ID de la orden de venta
 * @returns Resultado de la operación
 */
export async function finalizeStay(
    stayId: string,
    roomId: string,
    salesOrderId: string
): Promise<Result<boolean>> {
    const supabase = createClient();

    try {
        const now = new Date().toISOString();

        // Actualizar estancia
        const { error: stayError } = await supabase
            .from("room_stays")
            .update({
                status: STAY_STATUS.FINALIZADA,
                actual_check_out_at: now,
            })
            .eq("id", stayId);

        if (stayError) {
            logger.error("Error finalizing stay", { stayId, error: stayError });
            return failure("Error al finalizar estancia", "STAY_FINALIZE_ERROR");
        }

        // Actualizar habitación a SUCIA
        const { error: roomError } = await supabase
            .from("rooms")
            .update({ status: ROOM_STATUS.SUCIA })
            .eq("id", roomId);

        if (roomError) {
            logger.error("Error updating room to SUCIA", { roomId, error: roomError });
            return failure("Error al actualizar habitación", "ROOM_UPDATE_ERROR");
        }

        // Actualizar orden de venta a ENDED
        const { error: orderError } = await supabase
            .from("sales_orders")
            .update({ status: "ENDED" })
            .eq("id", salesOrderId);

        if (orderError) {
            logger.error("Error updating sales order", { salesOrderId, error: orderError });
            return failure("Error al actualizar orden", "ORDER_UPDATE_ERROR");
        }

        return success(true);
    } catch (error) {
        logger.error("Unexpected error finalizing stay", error);
        return failure("Error inesperado al finalizar estancia", "STAY_FINALIZE_EXCEPTION");
    }
}
