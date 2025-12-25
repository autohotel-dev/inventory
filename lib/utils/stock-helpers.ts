import { createClient } from "@/lib/supabase/client";

/**
 * Calcula el stock disponible de un producto en un almacén específico
 * sumando todos los movimientos de inventario (IN - OUT)
 * 
 * @param productId - UUID del producto
 * @param warehouseId - UUID del almacén
 * @returns Cantidad disponible en stock (nunca negativo)
 */
export async function getAvailableStock(
    productId: string,
    warehouseId: string
): Promise<number> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from("inventory_movements")
            .select("quantity, movement_type")
            .eq("product_id", productId)
            .eq("warehouse_id", warehouseId);

        if (error) {
            console.error("Error fetching inventory movements:", error);
            throw error;
        }

        if (!data || data.length === 0) {
            return 0; // Sin movimientos = sin stock
        }

        const stock = data.reduce((total, mov) => {
            if (mov.movement_type === "IN") {
                return total + mov.quantity;
            } else if (mov.movement_type === "OUT") {
                return total - mov.quantity;
            }
            return total;
        }, 0);

        return Math.max(0, stock);
    } catch (error) {
        console.error("Error calculating stock:", error);
        throw error;
    }
}

/**
 * Valida si hay stock suficiente para múltiples productos
 * 
 * @param items - Array de items con product_id y quantity requerida
 * @param warehouseId - ID del almacén
 * @returns Array de errores (vacío si todo OK)
 */
export async function validateStockAvailability(
    items: Array<{ product_id: string; product_name: string; quantity: number }>,
    warehouseId: string
): Promise<string[]> {
    const errors: string[] = [];

    for (const item of items) {
        try {
            const available = await getAvailableStock(item.product_id, warehouseId);

            if (available < item.quantity) {
                errors.push(
                    `${item.product_name}: Disponible ${available}, Solicitado ${item.quantity}`
                );
            }
        } catch (error) {
            errors.push(`${item.product_name}: Error verificando stock`);
        }
    }

    return errors;
}
