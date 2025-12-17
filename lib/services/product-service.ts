/**
 * Servicio para operaciones relacionadas con productos
 */
import { createClient } from "@/lib/supabase/client";
import { Result, success, failure } from "@/lib/types/api";
import {
    SERVICE_PRODUCT_SKU,
    SERVICE_PRODUCT_NAME,
    SERVICE_PRODUCT_DESCRIPTION,
} from "@/lib/constants/payment-constants";
import { logger } from "@/lib/utils/logger";

/**
 * Obtiene o crea el producto de servicio de habitación
 * Este producto se usa para registrar cargos de servicios (horas extra, personas extra, etc.)
 * @returns Resultado con el ID del producto de servicio
 */
export async function getOrCreateServiceProduct(): Promise<Result<string>> {
    const supabase = createClient();

    try {
        // Intentar obtener el producto existente
        const { data: existingProducts, error: fetchError } = await supabase
            .from("products")
            .select("id")
            .eq("sku", SERVICE_PRODUCT_SKU)
            .limit(1);

        if (fetchError) {
            logger.error("Error fetching service product", fetchError);
            return failure("Error al buscar producto de servicio", "PRODUCT_FETCH_ERROR");
        }

        // Si existe, retornar su ID
        if (existingProducts && existingProducts.length > 0) {
            return success(existingProducts[0].id);
        }

        // Si no existe, crearlo
        const { data: newProduct, error: createError } = await supabase
            .from("products")
            .insert({
                name: SERVICE_PRODUCT_NAME,
                sku: SERVICE_PRODUCT_SKU,
                description: SERVICE_PRODUCT_DESCRIPTION,
                price: 0,
                cost: 0,
                unit: "SVC",
                min_stock: 0,
                is_active: true,
            })
            .select("id")
            .single();

        if (createError || !newProduct) {
            logger.error("Error creating service product", createError);
            return failure("Error al crear producto de servicio", "PRODUCT_CREATE_ERROR");
        }

        logger.info("Service product created", { productId: newProduct.id });
        return success(newProduct.id);
    } catch (error) {
        logger.error("Unexpected error in getOrCreateServiceProduct", error);
        return failure("Error inesperado con producto de servicio", "PRODUCT_EXCEPTION");
    }
}

/**
 * Crea un item de venta para un servicio
 * @param salesOrderId - ID de la orden de venta
 * @param unitPrice - Precio unitario del servicio
 * @param conceptType - Tipo de concepto (EXTRA_PERSON, EXTRA_HOUR, etc.)
 * @param qty - Cantidad (por defecto 1)
 * @returns Resultado de la operación
 */
export async function createServiceItem(
    salesOrderId: string,
    unitPrice: number,
    conceptType: string,
    qty: number = 1
): Promise<Result<boolean>> {
    const supabase = createClient();

    try {
        // Obtener o crear el producto de servicio
        const productResult = await getOrCreateServiceProduct();
        if (!productResult.success) {
            return failure(productResult.error, productResult.code);
        }

        const serviceProductId = productResult.data;

        // Crear el item de venta
        const { error } = await supabase.from("sales_order_items").insert({
            sales_order_id: salesOrderId,
            product_id: serviceProductId,
            qty,
            unit_price: unitPrice,
            concept_type: conceptType,
            is_paid: false,
        });

        if (error) {
            logger.error("Error creating service item", { salesOrderId, conceptType, error });
            return failure("Error al crear item de servicio", "ITEM_CREATE_ERROR");
        }

        return success(true);
    } catch (error) {
        logger.error("Unexpected error creating service item", error);
        return failure("Error inesperado al crear item", "ITEM_CREATE_EXCEPTION");
    }
}

/**
 * Actualiza los items no pagados de un tipo específico a pagados
 * @param salesOrderId - ID de la orden de venta
 * @param conceptType - Tipo de concepto (EXTRA_PERSON, EXTRA_HOUR, etc.)
 * @param paymentMethod - Método de pago
 * @returns Resultado con la cantidad de items actualizados
 */
export async function updateUnpaidItems(
    salesOrderId: string,
    conceptType: string,
    paymentMethod: string
): Promise<Result<number>> {
    const supabase = createClient();

    try {
        // Buscar items no pagados de este concepto
        const { data: unpaidItems } = await supabase
            .from("sales_order_items")
            .select("id")
            .eq("sales_order_id", salesOrderId)
            .eq("concept_type", conceptType)
            .eq("is_paid", false);

        if (!unpaidItems || unpaidItems.length === 0) {
            return success(0); // No hay items para actualizar
        }

        // Actualizar todos los items no pagados
        const { error } = await supabase
            .from("sales_order_items")
            .update({
                is_paid: true,
                paid_at: new Date().toISOString(),
                payment_method: paymentMethod
            })
            .eq("sales_order_id", salesOrderId)
            .eq("concept_type", conceptType)
            .eq("is_paid", false);

        if (error) {
            logger.error("Error updating unpaid items", error);
            return failure("Error al actualizar items", "UPDATE_ERROR");
        }

        logger.info("Updated unpaid items", {
            salesOrderId,
            conceptType,
            count: unpaidItems.length
        });

        return success(unpaidItems.length);
    } catch (error) {
        logger.error("Error in updateUnpaidItems", error);
        return failure("Error inesperado", "EXCEPTION");
    }
}
