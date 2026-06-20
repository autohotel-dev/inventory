/**
 * Servicio para operaciones de consumos y items de venta
 * Centraliza queries sobre sales_order_items.
 * 
 * Usado por: use-valet-actions, use-consumption-cart, use-reprint-center
 */
import { createClient } from "@/lib/supabase/client";
import { Result, success, failure } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";

// ─── Types ───────────────────────────────────────────────────────────

export interface ConsumptionItem {
    id: string;
    sales_order_id: string;
    product_id?: string;
    concept_type: string;
    qty: number;
    unit_price: number;
    total: number;
    is_paid: boolean;
    is_courtesy: boolean;
    courtesy_reason?: string | null;
    is_cancelled: boolean;
    delivery_status: string | null;
    delivery_accepted_at: string | null;
    delivery_completed_at: string | null;
    delivery_accepted_by: string | null;
    delivery_notes: string | null;
    tip_amount?: number;
    tip_method?: string;
    shift_session_id?: string | null;
    created_at: string;
}

export interface DeliveryUpdate {
    delivery_status: string;
    delivery_accepted_at?: string;
    delivery_completed_at?: string;
    delivery_notes?: string | null;
    delivery_accepted_by?: string;
    is_paid?: boolean;
    tip_amount?: number;
    tip_method?: string;
}

// ─── Queries ─────────────────────────────────────────────────────────

/**
 * Obtiene un item por su ID
 */
export async function getItemById(
    itemId: string
): Promise<Result<ConsumptionItem>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("sales_order_items")
            .select("*")
            .eq("id", itemId)
            .single();

        if (error) {
            logger.error("Error fetching item", { itemId, error });
            return failure("No se pudo obtener el item", "ITEM_FETCH_ERROR");
        }
        return success(data as ConsumptionItem);
    } catch (error) {
        logger.error("Unexpected error fetching item", error);
        return failure("Error inesperado", "ITEM_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene extras sin pagar de una orden
 */
export async function getUnpaidExtras(
    salesOrderId: string
): Promise<Result<{ id: string }[]>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("sales_order_items")
            .select("id")
            .eq("sales_order_id", salesOrderId)
            .eq("concept_type", "EXTRA_PERSON")
            .eq("is_paid", false);

        if (error) {
            logger.error("Error fetching unpaid extras", { salesOrderId, error });
            return failure("Error al obtener extras", "EXTRAS_FETCH_ERROR");
        }
        return success(data || []);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "EXTRAS_FETCH_EXCEPTION");
    }
}

/**
 * Marca items como pagados/entregados
 */
export async function updateItemDelivery(
    itemId: string,
    update: DeliveryUpdate
): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { error } = await supabase
            .from("sales_order_items")
            .update(update)
            .eq("id", itemId);

        if (error) {
            logger.error("Error updating item delivery", { itemId, error });
            return failure("Error al actualizar entrega", "DELIVERY_UPDATE_ERROR");
        }
        return success(true);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "DELIVERY_UPDATE_EXCEPTION");
    }
}

/**
 * Marca múltiples items como entregados (batch)
 */
export async function updateItemsDeliveryBatch(
    itemIds: string[],
    update: DeliveryUpdate
): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { error } = await supabase
            .from("sales_order_items")
            .update(update)
            .in("id", itemIds);

        if (error) {
            logger.error("Error batch updating delivery", { itemIds, error });
            return failure("Error al actualizar entregas", "BATCH_DELIVERY_ERROR");
        }
        return success(true);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "BATCH_DELIVERY_EXCEPTION");
    }
}

/**
 * Marca extras como pagados por el valet
 */
export async function markExtrasAsPaid(
    itemIds: string[],
    valetId: string
): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { error } = await supabase
            .from("sales_order_items")
            .update({
                is_paid: true,
                delivery_status: "DELIVERED",
                delivery_completed_at: new Date().toISOString(),
                delivery_accepted_at: new Date().toISOString(),
                delivery_accepted_by: valetId,
            })
            .in("id", itemIds);

        if (error) {
            logger.error("Error marking extras as paid", { itemIds, error });
            return failure("Error al marcar extras", "EXTRAS_PAID_ERROR");
        }
        return success(true);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "EXTRAS_PAID_EXCEPTION");
    }
}

/**
 * Cancela un item de consumo
 */
export async function cancelItem(
    itemId: string,
    reason?: string
): Promise<Result<boolean>> {
    const supabase = createClient();
    try {
        const { error } = await supabase
            .from("sales_order_items")
            .update({
                is_cancelled: true,
                delivery_status: "CANCELLED",
                delivery_notes: reason || "Cancelado por cochero",
            })
            .eq("id", itemId);

        if (error) {
            logger.error("Error cancelling item", { itemId, error });
            return failure("Error al cancelar item", "CANCEL_ERROR");
        }
        return success(true);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "CANCEL_EXCEPTION");
    }
}

/**
 * Inserta un item de cargo (daño, hora extra, persona extra)
 */
export async function insertChargeItem(data: {
    sales_order_id: string;
    product_id?: string;
    concept_type: string;
    description?: string;
    qty: number;
    unit_price: number;
    total: number;
    delivery_status?: string;
    delivery_completed_at?: string;
    delivery_accepted_by?: string;
    shift_session_id?: string;
    is_paid?: boolean;
}): Promise<Result<any>> {
    const supabase = createClient();
    try {
        const { data: item, error } = await supabase
            .from("sales_order_items")
            .insert(data)
            .select()
            .single();

        if (error) {
            logger.error("Error inserting charge item", { error });
            return failure("Error al crear cargo", "CHARGE_INSERT_ERROR");
        }
        return success(item);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "CHARGE_INSERT_EXCEPTION");
    }
}

/**
 * Obtiene consumos por rango de fecha (para reimpresión)
 */
export async function getConsumptionsByDateRange(
    from: Date,
    to: Date
): Promise<Result<any[]>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("sales_order_items")
            .select(`id, qty, unit_price, total, created_at, concept_type, is_courtesy,
                products(name),
                sales_orders!inner(id, room_stays(rooms(number)))`)
            .eq("concept_type", "CONSUMPTION")
            .gte("created_at", from.toISOString())
            .lte("created_at", to.toISOString())
            .order("created_at", { ascending: false });

        if (error) {
            logger.error("Error fetching consumptions", { error });
            return failure("Error al cargar consumos", "CONSUMPTIONS_FETCH_ERROR");
        }
        return success(data || []);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "CONSUMPTIONS_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene items accrual por sesión de turno
 */
export async function getAccrualItemsBySession(
    shiftSessionId: string
): Promise<Result<any[]>> {
    const supabase = createClient();
    try {
        const { data, error } = await supabase
            .from("sales_order_items")
            .select(`id, qty, unit_price, concept_type, is_courtesy, courtesy_reason, is_cancelled,
                products(name),
                sales_orders(id, room_stays(status, rooms(number, room_types(name))))`)
            .eq("shift_session_id", shiftSessionId);

        if (error) {
            logger.error("Error fetching accrual items", { shiftSessionId, error });
            return failure("Error al cargar items", "ACCRUAL_FETCH_ERROR");
        }
        return success(data || []);
    } catch (error) {
        logger.error("Unexpected error", error);
        return failure("Error inesperado", "ACCRUAL_FETCH_EXCEPTION");
    }
}
