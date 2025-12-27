// types/expenses.ts
/**
 * Types for the Shift Expenses system
 */

export type ExpenseType =
    | 'UBER'        // Transporte para empleados
    | 'MAINTENANCE' // Mantenimiento (plomero, electricista)
    | 'REPAIR'      // Reparaciones de equipos
    | 'SUPPLIES'    // Insumos urgentes
    | 'PETTY_CASH'  // Caja chica
    | 'OTHER';      // Otro gasto

export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface ShiftExpense {
    id: string;
    shift_session_id: string;
    employee_id: string;
    authorized_by?: string | null;
    expense_type: ExpenseType;
    description: string;
    amount: number;
    recipient?: string | null;
    receipt_number?: string | null;
    notes?: string | null;
    created_at: string;
    created_by?: string | null;
    status: ExpenseStatus;
}

export interface CreateExpenseData {
    shift_session_id: string;
    employee_id: string;
    expense_type: ExpenseType;
    description: string;
    amount: number;
    recipient?: string;
    receipt_number?: string;
    notes?: string;
}

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
    UBER: 'Uber / Transporte',
    MAINTENANCE: 'Mantenimiento',
    REPAIR: 'Reparación',
    SUPPLIES: 'Insumos',
    PETTY_CASH: 'Caja Chica',
    OTHER: 'Otro Gasto'
};

export const EXPENSE_TYPE_ICONS: Record<ExpenseType, string> = {
    UBER: '🚗',
    MAINTENANCE: '🔧',
    REPAIR: '🛠️',
    SUPPLIES: '📦',
    PETTY_CASH: '💵',
    OTHER: '📝'
};
