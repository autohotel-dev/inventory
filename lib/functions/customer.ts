/**
 * Funciones para operaciones con clientes
 */
import { createClient } from "@/lib/supabase/client";
import { Customer, CustomerSales } from "@/lib/types/inventory";
import { Result, success, failure } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";

/**
 * Obtiene un cliente por su ID (con Result pattern)
 * @param id - ID del cliente
 * @returns Resultado con el cliente o error
 */
export async function getCustomerResult(id: string): Promise<Result<Customer>> {
    const supabase = createClient();

    logger.debug("Fetching customer", { customerId: id });

    try {
        const { data: customersData, error: customersError } = await supabase
            .from("customers")
            .select("*")
            .eq("id", id)
            .maybeSingle();

        if (customersError) {
            logger.error("Error fetching customer", { customerId: id, error: customersError });
            return failure("No se pudo obtener el cliente", "CUSTOMER_FETCH_ERROR");
        }

        if (!customersData) {
            logger.warn("Customer not found", { customerId: id });
            return failure("Cliente no encontrado", "CUSTOMER_NOT_FOUND");
        }

        return success(customersData as Customer);
    } catch (error) {
        logger.error("Unexpected error fetching customer", error);
        return failure("Error inesperado al obtener cliente", "CUSTOMER_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene un cliente por su ID (backward compatible)
 * @param id - ID del cliente
 * @returns Cliente o null si no se encuentra
 * @deprecated Usar getCustomerResult para mejor manejo de errores
 */
export async function getCustomer(id: string): Promise<Customer | null> {
    const result = await getCustomerResult(id);
    return result.success ? result.data : null;
}

/**
 * Obtiene todos los clientes (con Result pattern)
 * @returns Resultado con el array de clientes o error
 */
export async function getCustomersResult(): Promise<Result<Customer[]>> {
    const supabase = createClient();

    logger.debug("Fetching all customers");

    try {
        const { data: customersData, error: customersError } = await supabase
            .from("customers")
            .select("*")
            .order("name", { ascending: true });

        if (customersError) {
            logger.error("Error fetching customers", customersError);
            return failure("No se pudieron obtener los clientes", "CUSTOMERS_FETCH_ERROR");
        }

        return success((customersData as Customer[]) || []);
    } catch (error) {
        logger.error("Unexpected error fetching customers", error);
        return failure("Error inesperado al obtener clientes", "CUSTOMERS_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene todos los clientes (backward compatible)
 * @returns Array de clientes o array vacío si hay error
 * @deprecated Usar getCustomersResult para mejor manejo de errores
 */
export async function getCustomers(): Promise<Customer[]> {
    const result = await getCustomersResult();
    return result.success ? result.data : [];
}

/**
 * Obtiene las ventas de un cliente (con Result pattern)
 * @param customerId - ID del cliente
 * @returns Resultado con el array de ventas o error
 */
export async function getCustomerSalesResult(customerId: string): Promise<Result<CustomerSales[]>> {
    const supabase = createClient();

    logger.debug("Fetching customer sales", { customerId });

    try {
        const { data: customerSalesData, error: customerSalesError } = await supabase
            .from("sales_orders")
            .select("*")
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false });

        if (customerSalesError) {
            logger.error("Error fetching customer sales", { customerId, error: customerSalesError });
            return failure("No se pudieron obtener las ventas del cliente", "CUSTOMER_SALES_FETCH_ERROR");
        }

        return success((customerSalesData as CustomerSales[]) || []);
    } catch (error) {
        logger.error("Unexpected error fetching customer sales", error);
        return failure("Error inesperado al obtener ventas", "CUSTOMER_SALES_FETCH_EXCEPTION");
    }
}

/**
 * Obtiene las ventas de un cliente (backward compatible)
 * @param customerId - ID del cliente
 * @returns Array de ventas o array vacío si hay error
 * @deprecated Usar getCustomerSalesResult para mejor manejo de errores
 */
export async function getCustomerSales(customerId: string): Promise<CustomerSales[]> {
    const result = await getCustomerSalesResult(customerId);
    return result.success ? result.data : [];
}