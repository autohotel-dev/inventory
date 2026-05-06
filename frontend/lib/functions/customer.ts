/**
 * Funciones para operaciones con clientes
 */
import { apiClient } from "@/lib/api/client";
import { Customer, CustomerSales } from "@/lib/types/inventory";
import { Result, success, failure } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";

/**
 * Obtiene un cliente por su ID (con Result pattern)
 * @param id - ID del cliente
 * @returns Resultado con el cliente o error
 */
export async function getCustomerResult(id: string): Promise<Result<Customer>> {
    logger.debug("Fetching customer", { customerId: id });

    try {
        const { data } = await apiClient.get(`/system/crud/customers/${id}`);

        if (!data) {
            logger.warn("Customer not found", { customerId: id });
            return failure("Cliente no encontrado", "CUSTOMER_NOT_FOUND");
        }

        return success(data as Customer);
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
    logger.debug("Fetching all customers");

    try {
        const { data } = await apiClient.get("/system/crud/customers");
        const result = Array.isArray(data) ? data : (data?.items || data?.results || []);
        return success(result as Customer[]);
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
    logger.debug("Fetching customer sales", { customerId });

    try {
        const { data } = await apiClient.get("/system/crud/sales_orders", {
            params: { customer_id: customerId }
        });
        const result = Array.isArray(data) ? data : (data?.items || data?.results || []);
        return success(result as CustomerSales[]);
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