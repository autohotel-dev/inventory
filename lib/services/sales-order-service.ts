/**
 * Servicio para operaciones relacionadas con órdenes de venta
 */
import { createClient } from "@/lib/supabase/client";
import { Result, success, failure } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";

/**
 * Resultado de actualización de totales
 */
export interface UpdateTotalsResult {
    newSubtotal: number;
    newTotal: number;
    newRemaining: number;
}

/**
 * Actualiza los totales de una orden de venta
 * @param salesOrderId - ID de la orden de venta
 * @param additionalAmount - Monto adicional a agregar
 * @returns Resultado con los nuevos totales
 */
export async function updateSalesOrderTotals(
    salesOrderId: string,
    additionalAmount: number
): Promise<Result<UpdateTotalsResult>> {
    const supabase = createClient();

    try {
        // Obtener datos actuales de la orden
        const { data: orderData, error: orderError } = await supabase
            .from("sales_orders")
            .select("subtotal, tax, paid_amount, remaining_amount")
            .eq("id", salesOrderId)
            .single();

        if (orderError || !orderData) {
            logger.error("Error fetching sales order", { salesOrderId, error: orderError });
            return failure("No se pudo obtener la orden de venta", "ORDER_FETCH_ERROR");
        }

        const subtotal = Number(orderData.subtotal) || 0;
        const tax = Number(orderData.tax) || 0;
        const currentRemaining = Number(orderData.remaining_amount) || 0;

        const newSubtotal = subtotal + additionalAmount;
        const newTotal = newSubtotal + tax;
        const newRemaining = currentRemaining + additionalAmount;

        // Actualizar la orden
        const { error: updateError } = await supabase
            .from("sales_orders")
            .update({
                subtotal: newSubtotal,
                total: newTotal,
                remaining_amount: newRemaining,
            })
            .eq("id", salesOrderId);

        if (updateError) {
            logger.error("Error updating sales order totals", { salesOrderId, error: updateError });
            return failure("No se pudieron actualizar los totales", "ORDER_UPDATE_ERROR");
        }

        return success({
            newSubtotal,
            newTotal,
            newRemaining,
        });
    } catch (error) {
        logger.error("Unexpected error updating sales order totals", error);
        return failure("Error inesperado al actualizar totales", "ORDER_UPDATE_EXCEPTION");
    }
}

/**
 * Obtiene el saldo pendiente de una orden de venta
 * @param salesOrderId - ID de la orden de venta
 * @returns Resultado con el saldo pendiente
 */
export async function getRemainingAmount(
    salesOrderId: string
): Promise<Result<number>> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("sales_orders")
            .select("remaining_amount")
            .eq("id", salesOrderId)
            .single();

        if (error || !data) {
            logger.error("Error fetching remaining amount", { salesOrderId, error });
            return failure("No se pudo obtener el saldo pendiente", "REMAINING_FETCH_ERROR");
        }

        return success(Number(data.remaining_amount) || 0);
    } catch (error) {
        logger.error("Unexpected error fetching remaining amount", error);
        return failure("Error inesperado al obtener saldo", "REMAINING_FETCH_EXCEPTION");
    }
}

/**
 * Actualiza el estado de una orden de venta
 * @param salesOrderId - ID de la orden de venta
 * @param status - Nuevo estado
 * @returns Resultado de la operación
 */
export async function updateSalesOrderStatus(
    salesOrderId: string,
    status: string
): Promise<Result<boolean>> {
    const supabase = createClient();

    try {
        const { error } = await supabase
            .from("sales_orders")
            .update({ status })
            .eq("id", salesOrderId);

        if (error) {
            logger.error("Error updating sales order status", { salesOrderId, status, error });
            return failure("No se pudo actualizar el estado", "STATUS_UPDATE_ERROR");
        }

        return success(true);
    } catch (error) {
        logger.error("Unexpected error updating sales order status", error);
        return failure("Error inesperado al actualizar estado", "STATUS_UPDATE_EXCEPTION");
    }
}

/**
 * Obtiene los datos completos de una orden de venta
 * @param salesOrderId - ID de la orden de venta
 * @returns Resultado con los datos de la orden
 */
export async function getSalesOrder(
    salesOrderId: string
): Promise<Result<any>> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("sales_orders")
            .select("*")
            .eq("id", salesOrderId)
            .single();

        if (error || !data) {
            logger.error("Error fetching sales order", { salesOrderId, error });
            return failure("No se pudo obtener la orden de venta", "ORDER_FETCH_ERROR");
        }

        return success(data);
    } catch (error) {
        logger.error("Unexpected error fetching sales order", error);
        return failure("Error inesperado al obtener orden", "ORDER_FETCH_EXCEPTION");
    }
}
