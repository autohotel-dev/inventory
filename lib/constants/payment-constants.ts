/**
 * Constantes relacionadas con pagos y transacciones
 */

/**
 * Métodos de pago disponibles
 */
export const PAYMENT_METHODS = {
    EFECTIVO: "EFECTIVO",
    TARJETA: "TARJETA",
    TRANSFERENCIA: "TRANSFERENCIA",
    PENDIENTE: "PENDIENTE",
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

/**
 * Estados de pago
 */
export const PAYMENT_STATUS = {
    PAGADO: "PAGADO",
    PENDIENTE: "PENDIENTE",
    CANCELADO: "CANCELADO",
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

/**
 * Tipos de pago
 */
export const PAYMENT_TYPE = {
    COMPLETO: "COMPLETO",
    PARCIAL: "PARCIAL",
} as const;

export type PaymentType = typeof PAYMENT_TYPE[keyof typeof PAYMENT_TYPE];

/**
 * Conceptos de pago
 */
export const PAYMENT_CONCEPT = {
    CHECKOUT: "CHECKOUT",
    PERSONA_EXTRA: "PERSONA_EXTRA",
    HORA_EXTRA: "HORA_EXTRA",
    TOLERANCIA_EXPIRADA: "TOLERANCIA_EXPIRADA",
    CONSUMO: "CONSUMO",
    SERVICIO: "SERVICIO",
} as const;

export type PaymentConcept = typeof PAYMENT_CONCEPT[keyof typeof PAYMENT_CONCEPT];

/**
 * Prefijos para referencias de pago
 */
export const PAYMENT_REFERENCE_PREFIX = {
    CHECKOUT: "CHK",
    PERSONA_EXTRA: "PEX",
    HORA_EXTRA: "HEX",
    TOLERANCIA: "TOL",
    SUBPAGO: "SUB",
    CONSUMO: "CON",
} as const;

export type PaymentReferencePrefix = typeof PAYMENT_REFERENCE_PREFIX[keyof typeof PAYMENT_REFERENCE_PREFIX];

/**
 * SKU del producto de servicio de habitación
 */
export const SERVICE_PRODUCT_SKU = "SVC-ROOM";

/**
 * Nombre del producto de servicio de habitación
 */
export const SERVICE_PRODUCT_NAME = "Servicio de Habitación";

/**
 * Descripción del producto de servicio de habitación
 */
export const SERVICE_PRODUCT_DESCRIPTION = "Servicios de habitación (estancia, horas extra, personas extra)";

/**
 * Tipos de concepto para items de venta
 */
export const CONCEPT_TYPE = {
    EXTRA_PERSON: "EXTRA_PERSON",
    EXTRA_HOUR: "EXTRA_HOUR",
    BASE_STAY: "BASE_STAY",
    CONSUMPTION: "CONSUMPTION",
} as const;

export type ConceptType = typeof CONCEPT_TYPE[keyof typeof CONCEPT_TYPE];
