/**
 * Servicio para operaciones relacionadas con estancias (room_stays)
 * Centraliza queries comunes de estancias usadas en múltiples hooks.
 * 
 * Usado por: use-reprint-center, use-valet-actions, use-consumption-cart,
 *            use-room-details, room-actions/*
 */
import { createClient } from "@/lib/supabase/client";
import { Result, success, failure } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";

// ─── Types ───────────────────────────────────────────────────────────

export interface StayBasic {
    id: string;
    room_id: string;
    check_in_at: string;
    expected_check_out_at: string | null;
    actual_check_out_at: string | null;
    status: string;
    current_people: number;
    total_people: number;
    vehicle_plate: string | null;
    vehicle_brand: string | null;
    vehicle_model: string | null;
    sales_order_id: string | null;
    tolerance_started_at: string | null;
    tolerance_type: string | null;
}

export interface StayWithRoom extends StayBasic {
    rooms: {
        id: string;
        number: string;
        room_types: {
            name: string;
            base_price: number;
            extra_person_price: number;
        };
    };
}

export interface StayWithDetails extends StayWithRoom {
    sales_orders: {
        id: string;
        total: number;
        remaining_amount: number;
        payments: Array<{
            id: string;
            amount: number;
            payment_method: string;
            created_at: string;
        }>;
        sales_order_items: Array<{
            concept_type: string;
            unit_price: number;
            qty: number;
        }>;
    };
}

export interface DateRange {
    from: Date;
    to: Date;
}

// ─── Common Select Strings ──────────────────────────────────────────

const SELECT_BASIC = "id, room_id, check_in_at, expected_check_out_at, actual_check_out_at, status, current_people, total_people, vehicle_plate, vehicle_brand, vehicle_model, sales_order_id, tolerance_started_at, tolerance_type";

const SELECT_WITH_ROOM = `${SELECT_BASIC}, rooms!inner(id, number, room_types(name, base_price, extra_person_price))`;

const SELECT_WITH_DETAILS = `${SELECT_WITH_ROOM}, sales_orders(id, total, remaining_amount, payments(id, amount, payment_method, created_at), sales_order_items(concept_type, unit_price, qty))`;

// ─── Queries ─────────────────────────────────────────────────────────

/**
 * Obtiene estancias activas, opcionalmente filtradas por room number
 */
export async function getActiveStays(roomNumber?: string): Promise<Result<StayWithRoom[]>> {
    const supabase = createClient();
    try {
        let query = supabase
            .from("room_stays")
            .select(SELECT_WITH_ROOM)
            .eq("status", "ACTIVA")
            .order("check_in_at", { ascending: false });

        if (roomNumber) {
            query = query.eq("rooms.number", roomNumber);
        }

        const { data, error } = await query;
        if (error) {
            logger.error("Error fetching active stays", { error });
            return failure("No se pudieron cargar las estancias activas", "STAYS_FETCH_ERROR");
        }
        return success((data || []) as unknown as StayWithRoom[]);
    } catch (error) {
        logger.error("Unexpected error fetching active stays", error);
        return failure("Error inesperado", "STAYS_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene estancias por rango de fecha de check-in
 */
export async function getStaysByCheckInRange(
    dateRange: DateRange,
    roomNumber?: string
): Promise<Result<StayWithDetails[]>> {
    const supabase = createClient();
    try {
        let query = supabase
            .from("room_stays")
            .select(SELECT_WITH_DETAILS)
            .gte("check_in_at", dateRange.from.toISOString())
            .lte("check_in_at", dateRange.to.toISOString())
            .in("status", ["ACTIVA", "FINALIZADA"])
            .order("check_in_at", { ascending: false });

        if (roomNumber?.trim()) {
            query = query.eq("rooms.number", roomNumber.trim());
        }

        const { data, error } = await query;
        if (error) {
            logger.error("Error fetching stays by check-in range", { dateRange, error });
            return failure("No se pudieron cargar las estancias", "STAYS_RANGE_ERROR");
        }
        return success((data || []) as unknown as StayWithDetails[]);
    } catch (error) {
        logger.error("Unexpected error fetching stays", error);
        return failure("Error inesperado", "STAYS_RANGE_EXCEPTION");
    }
}

/**
 * Obtiene estancias finalizadas por rango de fecha de checkout
 */
export async function getStaysByCheckoutRange(
    dateRange: DateRange,
    roomNumber?: string
): Promise<Result<any[]>> {
    const supabase = createClient();
    try {
        let query = supabase
            .from("room_stays")
            .select(`id, check_in_at, actual_check_out_at, total_people, vehicle_plate, sales_order_id, 
                rooms!inner(number, room_types(name)), 
                sales_orders(id, total, remaining_amount, payments(id, amount, payment_method, created_at)),
                checkout_valet_employee_id, valet_employee_id`)
            .not("actual_check_out_at", "is", null)
            .gte("actual_check_out_at", dateRange.from.toISOString())
            .lte("actual_check_out_at", dateRange.to.toISOString())
            .eq("status", "FINALIZADA")
            .order("actual_check_out_at", { ascending: false });

        if (roomNumber?.trim()) {
            query = query.eq("rooms.number", roomNumber.trim());
        }

        const { data, error } = await query;
        if (error) {
            logger.error("Error fetching stays by checkout range", { dateRange, error });
            return failure("No se pudieron cargar las salidas", "CHECKOUT_RANGE_ERROR");
        }
        return success(data || []);
    } catch (error) {
        logger.error("Unexpected error fetching checkouts", error);
        return failure("Error inesperado", "CHECKOUT_RANGE_EXCEPTION");
    }
}

/**
 * Obtiene la estancia activa de un room por ID
 */
export async function getActiveStayByRoomId(roomId: string): Promise<Result<StayBasic | null>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("room_stays")
            .select(SELECT_BASIC)
            .eq("room_id", roomId)
            .eq("status", "ACTIVA")
            .maybeSingle();

        if (error) {
            logger.error("Error fetching active stay by room", { roomId, error });
            return failure("Error al obtener estancia activa", "STAY_FETCH_ERROR");
        }
        return success(data as StayBasic | null);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "STAY_FETCH_EXCEPTION");
    }
}

/**
 * Actualiza datos de vehículo en la estancia
 */
export async function updateVehicleInfo(
    stayId: string,
    vehicle: { plate: string; brand?: string; model?: string; color?: string }
): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { error } = await supabase
            .from("room_stays")
            .update({
                vehicle_plate: vehicle.plate,
                vehicle_brand: vehicle.brand || null,
                vehicle_model: vehicle.model || null,
                vehicle_color: vehicle.color || null,
            })
            .eq("id", stayId);

        if (error) {
            logger.error("Error updating vehicle info", { stayId, error });
            return failure("Error al actualizar vehículo", "VEHICLE_UPDATE_ERROR");
        }
        return success(true);
    } catch (error) {
        logger.error("Unexpected error updating vehicle", error);
        return failure("Error inesperado", "VEHICLE_UPDATE_EXCEPTION");
    }
}
