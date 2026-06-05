// types/employee-charges.ts
/**
 * Types for the Employee Charges system.
 * Tracks internal employee consumptions (breakfasts, products, etc.)
 * with support for discounts and multiple payment methods.
 */

export type ChargeType =
    | 'BREAKFAST'     // Desayuno
    | 'LUNCH'         // Comida
    | 'CONSUMPTION'   // Consumo general
    | 'PRODUCT'       // Producto específico
    | 'OTHER';        // Otro

export type ChargePaymentMethod =
    | 'CASH'              // Efectivo (entra a caja)
    | 'DEDUCCION_NOMINA'  // Se descuenta de nómina
    | 'COURTESY';         // Cortesía (sin cobro)

export type DiscountType =
    | 'PERCENTAGE'    // Porcentaje (ej: 50%)
    | 'FIXED_AMOUNT'  // Monto fijo (ej: $30 de descuento)
    | 'FULL';         // Cortesía total (100%)

export type ChargeStatus = 'pending' | 'approved' | 'rejected';

export interface EmployeeCharge {
    id: string;
    shift_session_id: string;
    registered_by: string;
    charged_to: string;
    charge_type: ChargeType;
    description: string;
    unit_price: number;
    quantity: number;
    subtotal: number;
    discount_type: DiscountType | null;
    discount_value: number;
    discount_amount: number;
    total: number;
    payment_method: ChargePaymentMethod;
    notes: string | null;
    status: ChargeStatus;
    created_at: string;
    // Relaciones (join opcional)
    charged_employee?: {
        id: string;
        first_name: string;
        last_name: string;
        role: string;
    } | null;
    registered_employee?: {
        id: string;
        first_name: string;
        last_name: string;
    } | null;
}

export interface CreateEmployeeChargeData {
    shift_session_id: string;
    registered_by: string;
    charged_to: string;
    charge_type: ChargeType;
    description: string;
    unit_price: number;
    quantity: number;
    discount_type?: DiscountType | null;
    discount_value?: number;
    payment_method: ChargePaymentMethod;
    notes?: string;
}

// ─── Labels & Icons ─────────────────────────────────────────────────

export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
    BREAKFAST: 'Desayuno',
    LUNCH: 'Comida',
    CONSUMPTION: 'Consumo',
    PRODUCT: 'Producto',
    OTHER: 'Otro',
};

export const CHARGE_TYPE_ICONS: Record<ChargeType, string> = {
    BREAKFAST: '🍳',
    LUNCH: '🍽️',
    CONSUMPTION: '☕',
    PRODUCT: '📦',
    OTHER: '📝',
};

export const PAYMENT_METHOD_LABELS: Record<ChargePaymentMethod, string> = {
    CASH: 'Efectivo',
    DEDUCCION_NOMINA: 'Desc. Nómina',
    COURTESY: 'Cortesía',
};

export const PAYMENT_METHOD_ICONS: Record<ChargePaymentMethod, string> = {
    CASH: '💵',
    DEDUCCION_NOMINA: '📋',
    COURTESY: '🎁',
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
    PERCENTAGE: 'Porcentaje',
    FIXED_AMOUNT: 'Monto fijo',
    FULL: 'Cortesía (100%)',
};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Calculates the discount amount and final total from charge inputs.
 */
export function calculateChargeTotal(
    unitPrice: number,
    quantity: number,
    discountType: DiscountType | null,
    discountValue: number
): { subtotal: number; discountAmount: number; total: number } {
    const subtotal = unitPrice * quantity;

    if (!discountType || discountValue <= 0) {
        return { subtotal, discountAmount: 0, total: subtotal };
    }

    let discountAmount = 0;

    switch (discountType) {
        case 'PERCENTAGE':
            discountAmount = Math.round((subtotal * Math.min(discountValue, 100)) / 100 * 100) / 100;
            break;
        case 'FIXED_AMOUNT':
            discountAmount = Math.min(discountValue, subtotal);
            break;
        case 'FULL':
            discountAmount = subtotal;
            break;
    }

    const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
    return { subtotal, discountAmount, total };
}
