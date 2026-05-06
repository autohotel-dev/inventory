/**
 * Servicio para operaciones relacionadas con habitaciones
 */
import { apiClient } from "@/lib/api/client";
import { Result, success, failure } from "@/lib/types/api";
import { ROOM_STATUS, STAY_STATUS, RoomStatus, StayStatus } from "@/lib/constants/room-constants";
import { logger } from "@/lib/utils/logger";
import { logAudit } from "@/lib/audit-logger";
import { RoomStay } from "@/components/sales/room-types";

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
    try {
        await apiClient.patch(`/system/crud/rooms/${roomId}`, { status });

        logAudit("UPDATE", { tableName: "rooms", recordId: roomId, description: `Estado de habitación cambiado a ${status}` });
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
    try {
        const { data } = await apiClient.get("/system/crud/room_stays", {
            params: { room_id: roomId, status: STAY_STATUS.ACTIVA, limit: 1 }
        });
        const results = Array.isArray(data) ? data : (data?.items || data?.results || []);
        return success(results.length > 0 ? results[0] as RoomStay : null);
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
    try {
        await apiClient.patch(`/system/crud/room_stays/${stayId}`, updates);
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
    try {
        const now = new Date().toISOString();

        // Actualizar estancia
        await apiClient.patch(`/system/crud/room_stays/${stayId}`, {
            status: STAY_STATUS.FINALIZADA,
            actual_check_out_at: now,
        });

        logAudit("UPDATE", { tableName: "room_stays", recordId: stayId, description: "Checkout: estancia finalizada" });

        // Actualizar habitación a SUCIA
        await apiClient.patch(`/system/crud/rooms/${roomId}`, { status: ROOM_STATUS.SUCIA });

        // Actualizar orden de venta a ENDED
        await apiClient.patch(`/system/crud/sales_orders/${salesOrderId}`, { status: "ENDED" });

        return success(true);
    } catch (error) {
        logger.error("Unexpected error finalizing stay", error);
        return failure("Error inesperado al finalizar estancia", "STAY_FINALIZE_EXCEPTION");
    }
}
