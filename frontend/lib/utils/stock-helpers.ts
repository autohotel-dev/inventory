import { createClient } from "@/lib/supabase/client";

/**
 * Calcula el stock disponible de un producto en un almacén específico
 * Consulta directamente la tabla stock (no calcula desde movimientos)
 * 
 * @param productId - UUID del producto
 * @param warehouseId - UUID del almacén
 * @returns Cantidad disponible en stock
 */
export async function getAvailableStock(
    productId: string,
    warehouseId: string
): Promise<number> {
    const supabase = createClient();

    try {
        console.log(`[STOCK CHECK] Checking stock for product: ${productId}, warehouse: ${warehouseId}`);

        // Consultar tabla stock directamente
        const { data, error } = await supabase
            .from("stock")
            .select("qty")
            .eq("product_id", productId)
            .eq("warehouse_id", warehouseId)
            .maybeSingle(); // Usar maybeSingle para evitar error si no existe

        if (error) {
            console.error("[STOCK ERROR] Error fetching stock:", error);
            return 0;
        }

        const qty = data?.qty || 0;
        console.log(`[STOCK CHECK] Found stock: ${qty}`);

        return Math.max(0, qty);
    } catch (error) {
        console.error("[STOCK ERROR] Error getting stock:", error);
        return 0; // Si hay error, asumir 0 stock
    }
}

/**
 * Valida si hay stock suficiente para múltiples productos
 * Primero busca en el warehouse especificado, luego en todos si no encuentra
 * 
 * @param items - Array de items con product_id y quantity requerida
 * @param warehouseId - ID del almacén preferido
 * @returns Array de errores (vacío si todo OK)
 */
export async function validateStockAvailability(
    items: Array<{ product_id: string; product_name: string; quantity: number }>,
    warehouseId: string
): Promise<string[]> {
    const supabase = createClient();
    const errors: string[] = [];

    for (const item of items) {
        try {
            // Primero buscar en el warehouse de la orden
            let available = await getAvailableStock(item.product_id, warehouseId);

            // Si no hay stock en el warehouse principal, buscar en TODOS los warehouses
            if (available < item.quantity) {
                console.log(`[STOCK] Not enough in primary warehouse (${available}/${item.quantity}). Searching all warehouses...`);

                // Obtener todos los warehouses
                const { data: warehouses } = await supabase
                    .from('warehouses')
                    .select('id, name')
                    .eq('is_active', true);

                if (warehouses && warehouses.length > 0) {
                    let totalAvailable = 0;
                    const warehouseStocks: Array<{ warehouse: string; stock: number }> = [];

                    // Buscar en cada warehouse
                    for (const wh of warehouses) {
                        const whStock = await getAvailableStock(item.product_id, wh.id);
                        if (whStock > 0) {
                            totalAvailable += whStock;
                            warehouseStocks.push({ warehouse: wh.name, stock: whStock });
                            console.log(`[STOCK] Found ${whStock} units in ${wh.name}`);
                        }
                    }

                    // Usar el stock total de todos los warehouses
                    available = totalAvailable;

                    if (totalAvailable > 0) {
                        console.log(`[STOCK] Total available across all warehouses: ${totalAvailable}`);
                        console.log(`[STOCK] Stock distribution:`, warehouseStocks);
                    }
                }
            }

            if (available < item.quantity) {
                errors.push(
                    `${item.product_name}: Disponible ${available}, Solicitado ${item.quantity}`
                );
            } else {
                console.log(`[STOCK] ✓ ${item.product_name}: OK (${available} available, ${item.quantity} needed)`);
            }
        } catch (error) {
            console.error(`[STOCK ERROR] Error validating ${item.product_name}:`, error);
            errors.push(`${item.product_name}: Error verificando stock`);
        }
    }

    return errors;
}
