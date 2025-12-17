/**
 * Servicio para operaciones relacionadas con pagos
 */
import { createClient } from "@/lib/supabase/client";
import { Result, success, failure } from "@/lib/types/api";
import {
    PAYMENT_REFERENCE_PREFIX,
    PaymentReferencePrefix,
    PAYMENT_METHODS,
    PAYMENT_STATUS,
    PAYMENT_TYPE,
    PaymentConcept,
} from "@/lib/constants/payment-constants";
import { logger } from "@/lib/utils/logger";

/**
 * Entrada de pago para multipagos
 */
export interface PaymentEntry {
    amount: number;
    method: string;
    reference?: string;
    terminal?: string;
}

/**
 * Datos para crear un pago
 */
export interface CreatePaymentData {
    salesOrderId: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
    concept: PaymentConcept;
    status?: string;
    paymentType?: string;
    parentPaymentId?: string;
    terminalCode?: string;
}

/**
 * Genera una referencia única para pagos
 * @param prefix - Prefijo para la referencia
 * @returns Referencia única
 */
export function generatePaymentReference(
    prefix: PaymentReferencePrefix | string = PAYMENT_REFERENCE_PREFIX.CHECKOUT
): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Crea un pago en la base de datos
 * @param data - Datos del pago
 * @returns Resultado con el ID del pago creado
 */
export async function createPayment(
    data: CreatePaymentData
): Promise<Result<string>> {
    const supabase = createClient();

    try {
        const { data: payment, error } = await supabase
            .from("payments")
            .insert({
                sales_order_id: data.salesOrderId,
                amount: data.amount,
                payment_method: data.paymentMethod,
                reference: data.reference || generatePaymentReference(),
                concept: data.concept,
                status: data.status || PAYMENT_STATUS.PAGADO,
                payment_type: data.paymentType || PAYMENT_TYPE.COMPLETO,
                ...(data.parentPaymentId && { parent_payment_id: data.parentPaymentId }),
                ...(data.terminalCode && { terminal_code: data.terminalCode }),
            })
            .select("id")
            .single();

        if (error) {
            logger.error("Error creating payment", error);
            return failure("No se pudo crear el pago", "PAYMENT_CREATE_ERROR");
        }

        return success(payment.id);
    } catch (error) {
        logger.error("Unexpected error creating payment", error);
        return failure("Error inesperado al crear el pago", "PAYMENT_CREATE_EXCEPTION");
    }
}

/**
 * Crea múltiples pagos (multipago)
 * @param salesOrderId - ID de la orden de venta
 * @param payments - Array de pagos a crear
 * @param concept - Concepto del pago
 * @returns Resultado con el ID del pago principal
 */
export async function createMultiPayment(
    salesOrderId: string,
    payments: PaymentEntry[],
    concept: PaymentConcept
): Promise<Result<string>> {
    const supabase = createClient();

    try {
        const validPayments = payments.filter((p) => p.amount > 0);
        const totalAmount = validPayments.reduce((sum, p) => sum + p.amount, 0);

        // Crear pago principal
        const { data: mainPayment, error: mainError } = await supabase
            .from("payments")
            .insert({
                sales_order_id: salesOrderId,
                amount: totalAmount,
                payment_method: PAYMENT_METHODS.PENDIENTE,
                reference: generatePaymentReference(),
                concept,
                status: PAYMENT_STATUS.PAGADO,
                payment_type: PAYMENT_TYPE.COMPLETO,
            })
            .select("id")
            .single();

        if (mainError || !mainPayment) {
            logger.error("Error creating main payment", mainError);
            return failure("No se pudo crear el pago principal", "MAIN_PAYMENT_ERROR");
        }

        // Crear subpagos
        const subpayments = validPayments.map((p) => ({
            sales_order_id: salesOrderId,
            amount: p.amount,
            payment_method: p.method,
            reference: p.reference || generatePaymentReference(PAYMENT_REFERENCE_PREFIX.SUBPAGO),
            concept,
            status: PAYMENT_STATUS.PAGADO,
            payment_type: PAYMENT_TYPE.PARCIAL,
            parent_payment_id: mainPayment.id,
            ...(p.method === PAYMENT_METHODS.TARJETA && p.terminal
                ? { terminal_code: p.terminal }
                : {}),
        }));

        const { error: subError } = await supabase
            .from("payments")
            .insert(subpayments);

        if (subError) {
            logger.error("Error creating subpayments", subError);
            return failure("No se pudieron crear los subpagos", "SUBPAYMENT_ERROR");
        }

        return success(mainPayment.id);
    } catch (error) {
        logger.error("Unexpected error creating multi payment", error);
        return failure("Error inesperado al crear el multipago", "MULTIPAYMENT_EXCEPTION");
    }
}

/**
 * Procesa un pago usando la función RPC de Supabase
 * @param orderId - ID de la orden
 * @param paymentAmount - Monto del pago
 * @returns Resultado del procesamiento
 */
export async function processPayment(
    orderId: string,
    paymentAmount: number
): Promise<Result<boolean>> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase.rpc("process_payment", {
            order_id: orderId,
            payment_amount: paymentAmount,
        });

        if (error) {
            logger.error("Error processing payment via RPC", error);
            return failure("Error al procesar el pago", "PAYMENT_PROCESS_ERROR");
        }

        const result = (data as any)?.[0];
        if (result?.success === false) {
            return failure(result.message || "No se pudo procesar el pago", "PAYMENT_PROCESS_FAILED");
        }

        return success(true);
    } catch (error) {
        logger.error("Unexpected error processing payment", error);
        return failure("Error inesperado al procesar el pago", "PAYMENT_PROCESS_EXCEPTION");
    }
}
